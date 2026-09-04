import { AuditLog } from '../models/AuditLog.js';

export async function getAuditLogs(req, res, next) {
  try {
    const { recoveryCaseId, actor, limit = 50, page = 1 } = req.query;

    const query = {};
    if (recoveryCaseId) {
      query.recoveryCaseId = recoveryCaseId;
    }
    if (actor && actor !== 'ALL') {
      query.actor = actor;
    }

    const total = await AuditLog.countDocuments(query);
    const logs = await AuditLog.find(query)
      .sort({ timestamp: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

const EVENT_CHRONO_RANK = {
  CASE_CREATED: 10,
  ROS_CALCULATED: 20,
  AI_ANALYZED: 30,
  AI_FALLBACK_USED: 30,
  POLICY_EVALUATED: 40,
  CASE_ESCALATED: 50,
  HUMAN_APPROVAL_GRANTED: 60,
  HUMAN_APPROVAL_REJECTED: 60,
  ACTION_EXECUTED: 70,
  ATTEMPT_FAILED: 80,
  REVENUE_RECOVERED: 90,
  MAX_RETRIES_STOP: 90,
  CASE_STOPPED: 90,
  DUPLICATE_ACTION_BLOCKED: 100
};

export async function getAgentActivityStream(req, res, next) {
  try {
    const { limit = 50 } = req.query;
    
    // Fetch decisions, policy checks, human approvals, action executions, and simulator outcomes
    const logs = await AuditLog.find({
      actor: { $in: ['AI_AGENT', 'POLICY_ENGINE', 'SIMULATOR', 'HUMAN', 'SYSTEM'] },
      event: { $nin: ['CASE_CREATED', 'ROS_CALCULATED'] }
    })
      .sort({ timestamp: -1, _id: -1 })
      .limit(Number(limit) * 2);

    const logDocs = logs.map(l => l.toObject());

    // Deterministic ordering: latest transaction events appear first,
    // while events within the same 1-second burst for the same case follow forward workflow order
    logDocs.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();

      if (Math.abs(timeA - timeB) <= 1000 && a.transactionId === b.transactionId) {
        const rankA = EVENT_CHRONO_RANK[a.event] || 50;
        const rankB = EVENT_CHRONO_RANK[b.event] || 50;
        return rankA - rankB;
      }

      return timeB - timeA;
    });

    res.json({
      success: true,
      data: logDocs.slice(0, Number(limit))
    });
  } catch (error) {
    next(error);
  }
}

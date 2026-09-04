import { RecoveryCase } from '../models/RecoveryCase.js';
import { Customer } from '../models/Customer.js';
import { Transaction } from '../models/Transaction.js';
import { RecoveryAction } from '../models/RecoveryAction.js';
import { AuditLog } from '../models/AuditLog.js';
import { explainWhyNotRetry } from '../services/policy/whyNotRetry.js';
import { processCaseWorkflow, handleHumanAction } from '../services/workflow/workflowEngine.js';

export async function getRecoveryCases(req, res, next) {
  try {
    const { state, minScore, search, sort = 'recoveryScore:desc', page = 1, limit = 25 } = req.query;

    const query = {};
    if (state && state !== 'ALL') {
      query.state = state;
    }
    if (minScore !== undefined && minScore !== '') {
      query.recoveryScore = { $gte: Number(minScore) };
    }
    if (search) {
      query.$or = [
        { recoveryCaseId: { $regex: search, $options: 'i' } },
        { transactionId: { $regex: search, $options: 'i' } },
        { customerId: { $regex: search, $options: 'i' } }
      ];
    }

    const sortOption = {};
    if (sort) {
      const [field, direction] = sort.split(':');
      sortOption[field] = direction === 'asc' ? 1 : -1;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await RecoveryCase.countDocuments(query);
    const cases = await RecoveryCase.find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(Number(limit));

    // Populate customer and transaction basic data
    const custIds = cases.map(c => c.customerId);
    const txnIds = cases.map(c => c.transactionId);
    const customers = await Customer.find({ customerId: { $in: custIds } });
    const transactions = await Transaction.find({ transactionId: { $in: txnIds } });

    const custMap = new Map(customers.map(c => [c.customerId, c]));
    const txnMap = new Map(transactions.map(t => [t.transactionId, t]));

    const enrichedCases = cases.map(c => ({
      ...c.toObject(),
      customer: custMap.get(c.customerId) || null,
      transaction: txnMap.get(c.transactionId) || null
    }));

    res.json({
      success: true,
      data: {
        cases: enrichedCases,
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

export async function getRecoveryCaseById(req, res, next) {
  try {
    const { id } = req.params;
    const recoveryCase = await RecoveryCase.findOne({
      $or: [{ recoveryCaseId: id }, { transactionId: id }]
    });

    if (!recoveryCase) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Recovery case '${id}' not found` }
      });
    }

    const customer = await Customer.findOne({ customerId: recoveryCase.customerId });
    const transaction = await Transaction.findOne({ transactionId: recoveryCase.transactionId });
    const actions = await RecoveryAction.find({ recoveryCaseId: recoveryCase.recoveryCaseId }).sort({ executedAt: 1 });
    const auditLogs = await AuditLog.find({ recoveryCaseId: recoveryCase.recoveryCaseId }).sort({ timestamp: 1 });

    res.json({
      success: true,
      data: {
        case: recoveryCase,
        customer,
        transaction,
        actions,
        auditLogs
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function getWhyNotRetryExplanation(req, res, next) {
  try {
    const { id } = req.params;
    const recoveryCase = await RecoveryCase.findOne({
      $or: [{ recoveryCaseId: id }, { transactionId: id }]
    });

    if (!recoveryCase) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Recovery case '${id}' not found` }
      });
    }

    const transaction = await Transaction.findOne({ transactionId: recoveryCase.transactionId });
    const explanation = explainWhyNotRetry({
      ...recoveryCase.toObject(),
      transaction
    });

    res.json({
      success: true,
      data: explanation
    });
  } catch (error) {
    next(error);
  }
}

export async function postCaseAction(req, res, next) {
  try {
    const { id } = req.params;
    const { action } = req.body;

    const recoveryCase = await RecoveryCase.findOne({
      $or: [{ recoveryCaseId: id }, { transactionId: id }]
    });

    if (!recoveryCase) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Recovery case '${id}' not found` }
      });
    }

    const transaction = await Transaction.findOne({ transactionId: recoveryCase.transactionId });
    const updatedCase = await handleHumanAction(recoveryCase, transaction, action);

    res.json({
      success: true,
      data: updatedCase
    });
  } catch (error) {
    next(error);
  }
}

export async function analyzeCase(req, res, next) {
  try {
    const { id } = req.params;
    const recoveryCase = await RecoveryCase.findOne({
      $or: [{ recoveryCaseId: id }, { transactionId: id }]
    });

    if (!recoveryCase) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Recovery case '${id}' not found` }
      });
    }

    const customer = await Customer.findOne({ customerId: recoveryCase.customerId });
    const transaction = await Transaction.findOne({ transactionId: recoveryCase.transactionId });

    const updatedCase = await processCaseWorkflow(recoveryCase, customer, transaction);

    res.json({
      success: true,
      data: updatedCase
    });
  } catch (error) {
    next(error);
  }
}

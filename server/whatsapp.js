/**
 * WhatsApp Serializer & Dispatch Engine
 * Conforms to Section 7 of KOart Technical Architecture Specification
 */

/**
 * @typedef {Object} WhatsAppDispatchConfig
 * @property {string} employeePhone
 * @property {string} companyName
 * @property {string} jobCode
 * @property {string} title
 * @property {string} [description]
 * @property {string} priority
 * @property {string} dueDateISO
 * @property {boolean} includeValueOnWa
 * @property {number} statedValue
 * @property {string} currency
 */

function cleanPhoneNumber(phone) {
  if (!phone) return '';
  return phone.replace(/[^0-9]/g, '');
}

function formatCurrency(val, currency = 'LKR') {
  return `${currency} ${Number(val || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Build official WhatsApp Job Card
 * As specified in Technical Proposal Section 7
 */
function buildWhatsAppJobCard(cfg) {
  const cleanPhone = cleanPhoneNumber(cfg.employeePhone);
  const valueLine = cfg.includeValueOnWa
    ? `\n*Job Value:* ${formatCurrency(cfg.statedValue, cfg.currency)}`
    : '';

  const dueDateFormatted = cfg.dueDateISO ? new Date(cfg.dueDateISO).toLocaleString('en-LK', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }) : 'Not Specified';

  const message =
    `*NEW JOB ASSIGNED: #${cfg.jobCode}*\n` +
    `*Company:* ${cfg.companyName}\n` +
    `*Task:* ${cfg.title}${valueLine}\n` +
    `*Priority:* ${String(cfg.priority || 'MEDIUM').toUpperCase()}\n` +
    `*Deadline:* ${dueDateFormatted}\n\n` +
    `*Instructions:*\n${cfg.description || 'Deliver in accordance with company quality standards.'}\n\n` +
    `_Please reply to this message with your progress updates._`;

  return {
    rawText: message,
    waMeUrl: `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`,
    webhookPayload: {
      to: cleanPhone,
      referenceId: cfg.jobCode,
      body: message
    }
  };
}

/**
 * Build 1-Click WhatsApp Follow-Up Reminder
 */
function buildWhatsAppFollowup(cfg) {
  const cleanPhone = cleanPhoneNumber(cfg.employeePhone);
  const dueDateFormatted = cfg.dueDateISO ? new Date(cfg.dueDateISO).toLocaleString('en-LK', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }) : 'Scheduled Deadline';

  const message =
    `*🔔 TASK STATUS FOLLOW-UP: #${cfg.jobCode}*\n` +
    `*Company:* ${cfg.companyName}\n` +
    `*Task:* ${cfg.title}\n` +
    `*Current Status:* ${String(cfg.status || 'IN PROGRESS').toUpperCase()}\n` +
    `*Deadline:* ${dueDateFormatted}\n\n` +
    `*Management Note:*\n${cfg.handlerNote || 'Kindly update executive management on your completion progress.'}\n\n` +
    `_Please reply with current progress ETA or blockers._`;

  return {
    rawText: message,
    waMeUrl: `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`,
    webhookPayload: {
      to: cleanPhone,
      referenceId: cfg.jobCode,
      action: 'followup',
      body: message
    }
  };
}

/**
 * Build WhatsApp Extension Notice (Pathway 1)
 */
function buildWhatsAppExtension(cfg) {
  const cleanPhone = cleanPhoneNumber(cfg.employeePhone);
  const newDueFormatted = new Date(cfg.newDueDateISO).toLocaleString('en-LK', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const message =
    `*⏱️ DEADLINE EXTENSION APPROVED: #${cfg.jobCode}*\n` +
    `*Company:* ${cfg.companyName}\n` +
    `*Task:* ${cfg.title}\n` +
    `*New Due Date:* ${newDueFormatted}\n` +
    `*Extension Reason:* ${cfg.reason || 'Operational adjustment'}\n\n` +
    `_Note: Original deadline remains recorded on company audit telemetry._`;

  return {
    rawText: message,
    waMeUrl: `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`,
    webhookPayload: {
      to: cleanPhone,
      referenceId: cfg.jobCode,
      action: 'extension',
      body: message
    }
  };
}

/**
 * Build WhatsApp Stop Notice (Pathway 2)
 */
function buildWhatsAppStopNotice(cfg) {
  const cleanPhone = cleanPhoneNumber(cfg.employeePhone);

  const message =
    `*🛑 WORK CEASE NOTIFICATION: #${cfg.jobCode}*\n` +
    `*Company:* ${cfg.companyName}\n` +
    `*Task:* ${cfg.title}\n` +
    `*Status:* STOPPED / WORK HALTED\n` +
    `*Category:* ${String(cfg.stopCategory || 'Management Halt').toUpperCase()}\n` +
    `*Reason:* ${cfg.reason || 'Task cancelled per management authorization.'}\n\n` +
    `_Please cease all further billable hours on this job code immediately._`;

  return {
    rawText: message,
    waMeUrl: `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`,
    webhookPayload: {
      to: cleanPhone,
      referenceId: cfg.jobCode,
      action: 'stopped',
      body: message
    }
  };
}

/**
 * Build WhatsApp Reassign Notice (Pathway 3)
 */
function buildWhatsAppReassign(cfg) {
  const cleanPhone = cleanPhoneNumber(cfg.employeePhone);
  const dueDateFormatted = new Date(cfg.dueDateISO).toLocaleString('en-LK', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const message =
    `*🔄 JOB REASSIGNMENT DISPATCH: #${cfg.jobCode}*\n` +
    `*Company:* ${cfg.companyName}\n` +
    `*Task:* ${cfg.title}\n` +
    `*Priority:* ${String(cfg.priority || 'HIGH').toUpperCase()}\n` +
    `*Deadline:* ${dueDateFormatted}\n\n` +
    `*Reassignment Instructions:*\n${cfg.description || 'Assigned to you for priority delivery.'}\n\n` +
    `_Please confirm receipt and commence work immediately._`;

  return {
    rawText: message,
    waMeUrl: `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`,
    webhookPayload: {
      to: cleanPhone,
      referenceId: cfg.jobCode,
      action: 'reassigned',
      body: message
    }
  };
}

module.exports = {
  cleanPhoneNumber,
  formatCurrency,
  buildWhatsAppJobCard,
  buildWhatsAppFollowup,
  buildWhatsAppExtension,
  buildWhatsAppStopNotice,
  buildWhatsAppReassign
};


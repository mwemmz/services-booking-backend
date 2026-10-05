/**
 * Booking timeline and earnings ledger.
 *
 * Shared by the booking controller and the expiry cron so both leave the same
 * trace: every status change gets a timeline row, and every booking carries a
 * ledger row that follows the money (PENDING -> EARNED, or VOID if the job never
 * happened).
 *
 * Both helpers swallow their own errors. A missing history row is a cosmetic
 * problem; failing the request that created it would be a much worse one.
 */
const { BookingStatusHistory, Transaction } = require('../models');

const recordStatus = async (bookingId, status, note, actorUserId = null) => {
  try {
    await BookingStatusHistory.create({
      booking_id: bookingId,
      status,
      note: note ?? null,
      actor_user_id: actorUserId,
    });
  } catch (error) {
    console.error('Failed to record booking status history:', error.message);
  }
};

const syncTransaction = async (booking, { amount, status } = {}) => {
  try {
    const existing = await Transaction.findOne({ where: { booking_id: booking.id } });
    const patch = {};
    if (amount !== undefined) patch.amount = amount;
    if (status !== undefined) {
      patch.status = status;
      patch.earned_at = status === 'EARNED' ? new Date() : null;
    }

    if (existing) {
      if (Object.keys(patch).length > 0) await existing.update(patch);
      return;
    }

    await Transaction.create({
      booking_id: booking.id,
      provider_id: booking.provider_id,
      customer_id: booking.customer_id,
      amount: amount ?? booking.total_amount,
      status: status ?? 'PENDING',
      earned_at: status === 'EARNED' ? new Date() : null,
    });
  } catch (error) {
    console.error('Failed to sync booking transaction:', error.message);
  }
};

module.exports = { recordStatus, syncTransaction };
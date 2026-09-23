const { Conversation, Message, Booking, Provider, User } = require('../models');
const { Op } = require('sequelize');
const { emitToUser, emitToBooking } = require('../config/socket');

const PUBLIC_USER_ATTRS = ['id', 'name', 'email', 'phone', 'profile_image'];

/** Resolve the conversation for a booking, creating it the first time it is opened. */
const getOrCreateConversation = async (booking) => {
  const existing = await Conversation.findOne({ where: { booking_id: booking.id } });
  if (existing) return existing;
  return Conversation.create({
    booking_id: booking.id,
    customer_id: booking.customer_id,
    provider_id: booking.provider_id,
  });
};

const resolveProviderUser = async (providerId) => {
  if (!providerId) return null;
  const profile = await Provider.findByPk(providerId, { attributes: ['user_id'] });
  return profile ? profile.user_id : null;
};

/** Return a conversation wrapped in an object matching /conversations/:id shape. */
const participantWhere = async (req) => {
  if (req.user.role === 'customer') {
    return { customer_id: req.user.id };
  }
  const provider = await Provider.findOne({ where: { user_id: req.user.id } });
  if (!provider) return null;
  return { provider_id: provider.id };
};

exports.getOrCreate = async (req, res) => {
  try {
    const booking = await Booking.findByPk(req.params.bookingId);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    const providerUser = await resolveProviderUser(booking.provider_id);
    const isCustomer = booking.customer_id === req.user.id;
    const isProvider = providerUser && providerUser === req.user.id;
    if (!isCustomer && !isProvider) {
      return res.status(403).json({ message: 'Only the customer or provider can open this chat.' });
    }

    const conversation = await getOrCreateConversation(booking);
    return res.json({
      conversation,
      booking_id: booking.id,
      provider_user_id: providerUser,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to open conversation.', error: error.message });
  }
};

exports.listConversations = async (req, res) => {
  try {
    const where = await participantWhere(req);
    if (!where) {
      return res.status(404).json({ message: 'Provider profile not found.' });
    }

    const conversations = await Conversation.findAll({
      where,
      include: [
        { model: Booking, as: 'booking' },
        { model: User, as: 'customer', attributes: PUBLIC_USER_ATTRS },
        { model: Provider, as: 'provider', include: [{ model: User, as: 'user', attributes: PUBLIC_USER_ATTRS }] },
      ],
      order: [['last_message_at', 'DESC']],
    });

    const enriched = await Promise.all(
      conversations.map(async (conversation) => {
        const me = req.user.id;
        const them = req.user.role === 'customer'
          ? (await resolveProviderUser(conversation.provider_id))
          : conversation.customer_id;
        const [lastMessage, unread] = await Promise.all([
          Message.findOne({ where: { conversation_id: conversation.id }, order: [['createdAt', 'DESC']] }),
          Message.count({ where: { conversation_id: conversation.id, is_read: false, sender_id: { [Op.ne]: me } } }),
        ]);
        return {
          id: conversation.id,
          booking_id: conversation.booking_id,
          customer: conversation.customer,
          provider: conversation.provider,
          other_user_id: them,
          last_message_at: conversation.last_message_at,
          last_message: lastMessage ? lastMessage.text : null,
          unread_count: unread,
        };
      }),
    );

    return res.json({ conversations: enriched });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to list conversations.', error: error.message });
  }
};

exports.listMessages = async (req, res) => {
  try {
    const conversation = await Conversation.findByPk(req.params.id);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found.' });
    }

    const providerUser = await resolveProviderUser(conversation.provider_id);
    const isCustomer = conversation.customer_id === req.user.id;
    const isProvider = providerUser && providerUser === req.user.id;
    if (!isCustomer && !isProvider) {
      return res.status(403).json({ message: 'Only chat participants can read messages.' });
    }

    const messages = await Message.findAll({
      where: { conversation_id: conversation.id },
      order: [['createdAt', 'ASC']],
    });

    // Mark everything from the other party as read now that this side opened the chat.
    const otherId = isCustomer ? providerUser : conversation.customer_id;
    if (otherId) {
      await Message.update(
        { is_read: true },
        { where: { conversation_id: conversation.id, sender_id: otherId, is_read: false } },
      );
    }

    return res.json({ messages, booking_id: conversation.booking_id });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch messages.', error: error.message });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !String(text).trim()) {
      return res.status(400).json({ message: 'message text is required.' });
    }

    const conversation = await Conversation.findByPk(req.params.id);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found.' });
    }

    const providerUser = await resolveProviderUser(conversation.provider_id);
    const isCustomer = conversation.customer_id === req.user.id;
    const isProvider = providerUser && providerUser === req.user.id;
    if (!isCustomer && !isProvider) {
      return res.status(403).json({ message: 'Only chat participants can send messages.' });
    }

    const message = await Message.create({
      conversation_id: conversation.id,
      sender_id: req.user.id,
      text: String(text).trim(),
      is_read: false,
    });
    await conversation.update({ last_message_at: new Date() });

    const payload = {
      conversationId: conversation.id,
      bookingId: conversation.booking_id,
      message: {
        id: message.id,
        sender_id: message.sender_id,
        text: message.text,
        createdAt: message.createdAt,
      },
    };

    // Realtime: both sides get it + everyone watching the booking screen.
    emitToBooking(conversation.booking_id, 'message:new', payload);
    emitToUser(conversation.customer_id, 'message:new', payload);
    if (providerUser) emitToUser(providerUser, 'message:new', payload);

    return res.status(201).json({
      message,
      conversation_id: conversation.id,
      booking_id: conversation.booking_id,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to send message.', error: error.message });
  }
};
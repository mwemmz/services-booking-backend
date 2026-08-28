const { Crew, CrewMember, Provider, User } = require('../models');

exports.createCrew = async (req, res) => {
  try {
    const provider = await Provider.findOne({ where: { user_id: req.user.id } });
    if (!provider) return res.status(404).json({ message: 'Provider not found.' });

    const { name, member_ids = [] } = req.body;
    if (!name) return res.status(400).json({ message: 'Crew name is required.' });

    const crew = await Crew.create({ leader_id: provider.id, name });

    const memberProviders = await Provider.findAll({ where: { id: member_ids } });
    if (memberProviders.length) {
      await crew.setMembers(memberProviders);
    }

    const full = await Crew.findByPk(crew.id, {
      include: [{ model: Provider, as: 'members', include: [{ model: User, as: 'user' }] }],
    });
    return res.status(201).json({ message: 'Crew created.', crew: full });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create crew.', error: error.message });
  }
};

exports.getMyCrews = async (req, res) => {
  try {
    const provider = await Provider.findOne({ where: { user_id: req.user.id } });
    if (!provider) return res.status(404).json({ message: 'Provider not found.' });

    const crews = await Crew.findAll({
      where: { leader_id: provider.id },
      include: [{ model: Provider, as: 'members', include: [{ model: User, as: 'user' }] }],
    });
    return res.json({ crews });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch crews.', error: error.message });
  }
};

exports.getCrewById = async (req, res) => {
  try {
    const crew = await Crew.findByPk(req.params.id, {
      include: [{ model: Provider, as: 'members', include: [{ model: User, as: 'user' }] }],
    });
    if (!crew) return res.status(404).json({ message: 'Crew not found.' });
    return res.json({ crew });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch crew.', error: error.message });
  }
};

exports.addMember = async (req, res) => {
  try {
    const { provider_id } = req.body;
    if (!provider_id) return res.status(400).json({ message: 'provider_id is required.' });

    const crew = await Crew.findByPk(req.params.id);
    if (!crew) return res.status(404).json({ message: 'Crew not found.' });

    const provider = await Provider.findByPk(provider_id);
    if (!provider) return res.status(404).json({ message: 'Provider member not found.' });

    if (crew.leader_id === provider_id) {
      return res.status(400).json({ message: 'Leader cannot be added as a member.' });
    }

    const existing = await CrewMember.findOne({ where: { crew_id: crew.id, provider_id } });
    if (existing) return res.status(409).json({ message: 'Provider already a member.' });

    await CrewMember.create({ crew_id: crew.id, provider_id });
    return res.status(201).json({ message: 'Member added to crew.' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to add member.', error: error.message });
  }
};

exports.removeMember = async (req, res) => {
  try {
    await CrewMember.destroy({ where: { crew_id: req.params.id, provider_id: req.params.memberId } });
    return res.json({ message: 'Member removed from crew.' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to remove member.', error: error.message });
  }
};

exports.deleteCrew = async (req, res) => {
  try {
    const crew = await Crew.findByPk(req.params.id);
    if (!crew) return res.status(404).json({ message: 'Crew not found.' });
    const provider = await Provider.findOne({ where: { user_id: req.user.id } });

    if (req.user.role !== 'admin' && crew.leader_id !== (provider && provider.id)) {
      return res.status(403).json({ message: 'Not authorized to delete this crew.' });
    }

    await crew.destroy();
    return res.json({ message: 'Crew deleted.' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete crew.', error: error.message });
  }
};
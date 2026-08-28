const { User } = require('../models');

exports.submitNationalId = async (req, res) => {
  try {
    const { national_id_number } = req.body;
    if (!national_id_number) {
      return res.status(400).json({ message: 'national_id_number is required.' });
    }

    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    await user.update({
      national_id_number,
      national_id_verified: false,
    });

    return res.json({
      message: 'National ID submitted for verification.',
      national_id_verified: false,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to submit National ID.', error: error.message });
  }
};

exports.verifyNationalId = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.userId);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    if (!user.national_id_number) {
      return res.status(400).json({ message: 'User has not submitted a National ID yet.' });
    }

    await user.update({ national_id_verified: true });

    return res.json({
      message: 'National ID verified.',
      user: {
        id: user.id,
        national_id_number: user.national_id_number,
        national_id_verified: true,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to verify National ID.', error: error.message });
  }
};

exports.getNationalIdStatus = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    return res.json({
      national_id_number: user.national_id_number || null,
      national_id_verified: user.national_id_verified,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch National ID status.', error: error.message });
  }
};
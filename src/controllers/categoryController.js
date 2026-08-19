const { Category } = require('../models');

exports.getAllCategories = async (req, res) => {
  try {
    const categories = await Category.findAll({ order: [['name', 'ASC']] });
    return res.json({ categories });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch categories.', error: error.message });
  }
};

exports.createCategory = async (req, res) => {
  try {
    const { name, icon, description } = req.body;

    const existing = await Category.findOne({ where: { name } });
    if (existing) {
      return res.status(409).json({ message: 'Category already exists.' });
    }

    const category = await Category.create({ name, icon, description });

    return res.status(201).json({ message: 'Category created.', category });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create category.', error: error.message });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found.' });
    }

    const { name, icon, description } = req.body;
    await category.update({ name, icon, description });

    return res.json({ message: 'Category updated.', category });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update category.', error: error.message });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found.' });
    }

    await category.destroy();

    return res.json({ message: 'Category deleted.' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete category.', error: error.message });
  }
};

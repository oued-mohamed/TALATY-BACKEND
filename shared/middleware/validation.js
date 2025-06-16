const Joi = require('joi');

const validationSchemas = {
  user: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    phone: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).optional()
  }),

  userProfile: Joi.object({
    first_name: Joi.string().min(2).max(100).required(),
    last_name: Joi.string().min(2).max(100).required(),
    business_name: Joi.string().min(2).max(200).required(),
    business_type: Joi.string().required(),
    tax_id: Joi.string().required(),
    address: Joi.object({
      street: Joi.string().required(),
      city: Joi.string().required(),
      state: Joi.string().required(),
      postal_code: Joi.string().required(),
      country: Joi.string().required()
    }).required()
  }),

  document: Joi.object({
    document_type: Joi.string().valid(
      'business_license', 
      'tax_certificate', 
      'bank_statement', 
      'identity_card',
      'passport'
    ).required()
  }),

  creditApplication: Joi.object({
    business_data: Joi.object({
      annual_revenue: Joi.number().positive().required(),
      employees_count: Joi.number().integer().min(1).required(),
      years_in_business: Joi.number().integer().min(0).required(),
      industry: Joi.string().required()
    }).required(),
    financial_data: Joi.object({
      monthly_revenue: Joi.number().positive().required(),
      monthly_expenses: Joi.number().positive().required(),
      debt_amount: Joi.number().min(0).required()
    }).optional()
  })
};

const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details.map(detail => detail.message)
      });
    }
    next();
  };
};

module.exports = {
  validationSchemas,
  validate
};
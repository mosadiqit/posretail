# -*- coding: utf-8 -*-
from odoo import api, models, fields
from odoo.exceptions import UserError
from datetime import datetime


class medical_insurance(models.Model):
    _name = "medical.insurance"
    _description = "Management Medical Insurance"
    _rec_name = 'employee'

    insurance_company_id = fields.Many2one('res.partner', string='Insurance company',
                                           domain=[('is_company', '=', True)], required=1)
    code = fields.Char('Code', copy=False)
    subscriber_id = fields.Many2one('res.partner', 'Subscriber',
                                    help='Subscriber name, could be a company or an individual person')
    patient_name = fields.Char('Patient name', required=1,
                               help='Patient full name, can be found on the medical prescription form')
    patient_number = fields.Char('Patient number', required=1, index=1,
                                 help='Patient Identification number, can be found on the medical prescription form')
    rate = fields.Float('Rate', help='Percentage rate covered by the insurance company, from 0 to 100%', required=1)
    medical_number = fields.Char('Medical number', help='Form number, can be found on the medical prescription form',
                                  required=1)
    employee = fields.Char('Employee',
                                help='Employee full name, may be different from patient name, can be found on the medical prescription form')
    phone = fields.Char('Tell number', help='Patient contact telephone number')
    product_id = fields.Many2one('product.product', 'Service', domain=[('type', '=', 'service')])
    active = fields.Boolean('Active', default=1)
    expired_date = fields.Datetime('Expired date')

    _sql_constraints = [
        ('patient_number_uniq', 'unique(patient_number)', 'Patient number must be unique per Company!'),
    ]

    @api.model
    def create(self, vals):
        if vals.get('rate') > 100 or vals.get('rate') <= 0:
            raise UserError(u'Rate does not smaller than 0 or bigger than 100')
        if not vals.get('product_id', False):
            products = self.env['product.product'].search([('default_code', '=', 'MS')])
            if products:
                vals.update({'product_id': products[0].id})
            else:
                raise UserError(
                    'Does not find product Medical Service with default code MS. Please create this product before create medical insurance')
        insurance = super(medical_insurance, self).create(vals)
        if not insurance.code:
            format_code = "%s%s%s" % ('666', insurance.id, datetime.now().strftime("%d%m%y%H%M"))
            code = self.env['barcode.nomenclature'].sanitize_ean(format_code)
            insurance.write({'code': code})
        return insurance

    @api.multi
    def write(self, vals):
        if vals.get('rate', None):
            if vals.get('rate') > 100 or vals.get('rate') <= 0:
                raise UserError(u'Rate does not smaller than 0 or bigger than 100')
        return super(medical_insurance, self).write(vals)

    @api.multi
    def unlink(self):
        for insurance in self:
            pos_orders = self.env['pos.order'].search(
                [('state', '=', 'paid'), ('medical_insurance_id', '=', insurance.id)])
            if pos_orders:
                raise UserError(u'This insurance have linked to pos order state paid, could not remove')
        return super(medical_insurance, self).unlink()

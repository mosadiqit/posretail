# -*- coding: utf-8 -*-
from odoo import api, fields, models, _
from odoo.exceptions import UserError

class product_price_quantity(models.Model):
    _name = "product.price.quantity"
    _description = "Sale price for each quantity"

    product_tmpl_id = fields.Many2one('product.template', 'Product template', required=1)
    price_unit = fields.Float('Price', required=1, help='Price ally with quantity smaller than or equal this quantity')
    quantity = fields.Float('Quantity', required=1, help='Quantity smaller than or equal, will apply price')


    @api.model
    def create(self, vals):
        if vals.get('price_unit') <= 0 or vals.get('quantity') <= 0:
            raise UserError(_('Price unit and quantity could not smaller than 0'))
        return super(product_price_quantity, self).create(vals)

    @api.multi
    def write(self, vals):
        if ((vals.get('price_unit', None) and vals.get('price_unit', None) <= 0) or vals.get('quantity', None) and vals.get('quantity', None) <= 0):
            raise UserError(_('Price unit and quantity could not smaller than 0'))
        return super(product_price_quantity, self).create(vals)


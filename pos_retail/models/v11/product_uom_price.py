# -*- coding: utf-8 -*-
from odoo import api, fields, models, _
from odoo.exceptions import UserError

class product_uom_price(models.Model):
    _name = "product.uom.price"
    _description = "Management product price each unit"

    uom_id = fields.Many2one('product.uom', 'Uom', required=1)
    product_tmpl_id = fields.Many2one('product.template', 'Product', domain=[('available_in_pos', '=', True)], required=1)
    price = fields.Float('Sale Price', required=1)

    @api.model
    def create(self, vals):
        product_template = self.env['product.template'].browse(vals.get('product_tmpl_id'))
        unit = self.env['product.uom'].browse(vals.get('uom_id'))
        if product_template.uom_id and product_template.uom_id.category_id != unit.category_id:
            raise UserError('Please choose unit the same category of base product unit is %s, for made linked stock inventory' % product_template.uom_id.category_id.name)
        return super(product_uom_price, self).create(vals)

    @api.multi
    def write(self, vals):
        if vals.get('uom_id', None):
            unit_will_change = self.env['product.uom'].browse(vals.get('uom_id'))
            for uom_price in self:
                if uom_price.product_tmpl_id.uom_id and uom_price.product_tmpl_id.uom_id.category_id != unit_will_change.category_id:
                    raise UserError(
                        'Please choose unit the same category of base product unit is %s, for made linked stock inventory' % uom_price.product_tmpl_id.uom_id.category_id.name)
        return super(product_uom_price, self).write(vals)
# -*- coding: utf-8 -*-
from odoo import api, fields, models, tools, _, registry

class pos_order_line(models.Model):
    _inherit = "pos.order.line"

    uom_id = fields.Many2one('uom.uom', 'Uom', readonly=1)

    @api.model
    def create(self, vals):
        line = super(pos_order_line, self).create(vals)
        if vals.get('uom_id', None):
            product = self.env['product.product'].browse(vals.get('product_id'))
            line_uom = self.env['uom.uom'].browse(vals.get('uom_id'))
            base_uom = product.uom_id
            if base_uom.category_id == line_uom.category_id and line.product_id.uom_id.factor_inv != 0:
                before_total = line.price_unit * line.qty
                line_qty = line.qty
                new_qty = line_qty * (line_uom.factor_inv / line.product_id.uom_id.factor_inv)
                new_price = before_total / new_qty
                line.write({
                    'name': '%s_sale_(%s)' % (line.name, line_uom.name),
                    'qty': new_qty,
                    'price_unit': new_price,
                })
        return line



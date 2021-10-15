# -*- coding: utf-8 -*-
from odoo import fields, api, models
import odoo

import logging
_logger = logging.getLogger(__name__)

class stock_picking(models.Model):
    _inherit = "stock.picking"

    pos_order_id = fields.Many2one('pos.order', 'POS order') # TODO: only for picking combo

    @api.model
    def create(self, vals):
        picking = super(stock_picking, self).create(vals)
        if picking.sale_id:
            self.env['pos.cache.database'].insert_data('sale.order', picking.sale_id.id)
        return picking

    @api.multi
    def write(self, vals):
        datas = super(stock_picking, self).write(vals)
        for picking in self:
            if picking.sale_id:
                self.env['pos.cache.database'].insert_data('sale.order', picking.sale_id.id)
        return datas

    @api.model
    def pos_made_internal_transfer(self, vals):
        version_info = odoo.release.version_info[0]
        internal_trasfer = self.create(vals)
        internal_trasfer.action_assign()
        if version_info in [11, 12]:
            for move_line in internal_trasfer.move_lines:
                move_line.write({'quantity_done': move_line.product_uom_qty})
            for move_line in internal_trasfer.move_line_ids:
                move_line.write({'qty_done': move_line.product_uom_qty})
            internal_trasfer.button_validate()
        if version_info == 10:
            transfer = self.env['stock.immediate.transfer'].create({'pick_id': internal_trasfer.id})
            transfer.process()
        return internal_trasfer.id





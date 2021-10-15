# -*- coding: utf-8 -*-
from odoo import fields, api, models

class stock_move_line(models.Model):

    _inherit = "stock.move.line"

    @api.model
    def create(self, vals):
        """
            * When cashier choose product have tracking is not none
            * And submit to sale order to backend
        """
        if vals.get('move_id', None):
            move = self.env['stock.move'].browse(vals.get('move_id'))
            if move.sale_line_id and move.sale_line_id.lot_id:
                vals.update({'lot_id': move.sale_line_id.lot_id.id})
        return super(stock_move_line, self).create(vals)



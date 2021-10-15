# -*- coding: utf-8 -*-
from odoo import fields, api, models

import logging
import base64
import json

_logger = logging.getLogger(__name__)


class StockMove(models.Model):
    _inherit = "stock.move"

    @api.model
    def create(self, vals):
        move = super(StockMove, self).create(vals)
        return move

class StockMoveLine(models.Model):
    _inherit = "stock.move.line"

    @api.model
    def create(self, vals):
        MoveLine = super(StockMoveLine, self).create(vals)
        if vals.get('picking_id', None):
            picking = self.env['stock.picking'].browse(vals.get('picking_id'))
            if picking.pos_order_id and picking.pos_order_id.location_id:
                vals.update({'location_id': picking.pos_order_id.location_id.id})
        return MoveLine


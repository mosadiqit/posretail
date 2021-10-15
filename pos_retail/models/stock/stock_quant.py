# -*- coding: utf-8 -*-
from odoo import fields, api, models

import logging
import json

_logger = logging.getLogger(__name__)


class StockQuant(models.Model):
    _inherit = "stock.quant"

    def send_notification_pos(self, product_ids):
        sessions = self.env['pos.session'].sudo().search([
            ('state', '=', 'opened'),
            ('config_id.display_onhand', '=', True)
        ])
        for session in sessions:
            self.env['bus.bus'].sendmany(
                [[(self.env.cr.dbname, 'pos.sync.stock', session.user_id.id), json.dumps({
                    'product_ids': product_ids,
                })]])
        return True

    @api.model
    def create(self, vals):
        quant = super(StockQuant, self).create(vals)
        self.send_notification_pos([quant.product_id.id])
        return quant

    @api.multi
    def write(self, vals):
        res = super(StockQuant, self).write(vals)
        product_ids = []
        for quant in self:
            product_ids.append(quant.product_id.id)
        if len(product_ids) > 0:
            self.send_notification_pos(product_ids)
        return res

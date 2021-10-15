# -*- coding: utf-8 -*-
from odoo import api, fields, models, _
import logging

_logger = logging.getLogger(__name__)

class AccountMove(models.Model):

    _inherit = "account.move"

    @api.model
    def create(self, vals):
        move = super(AccountMove, self).create(vals)
        return move

class AccountMoveLine(models.Model):
    _inherit = "account.move.line"

    @api.one
    def _prepare_analytic_line(self):
        analytic_line_value = super(AccountMoveLine, self)._prepare_analytic_line()
        if analytic_line_value and analytic_line_value[0] and not analytic_line_value[0].get('name', None):
            analytic_line_value[0]['name'] = self.ref or self.move_id.ref
        return analytic_line_value[0]
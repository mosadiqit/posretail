# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class ReportPosOrder(models.Model):
    _inherit = 'report.pos.order'

    margin = fields.Float('Margin')
    pos_branch_id = fields.Many2one('pos.branch', 'Branch')

    def _select(self):
        return super(ReportPosOrder, self)._select() + ", SUM(l.margin) AS margin, l.pos_branch_id as pos_branch_id"

    def _group_by(self):
        return super(ReportPosOrder, self)._group_by() + ", l.pos_branch_id"

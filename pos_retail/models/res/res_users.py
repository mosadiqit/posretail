# -*- coding: utf-8 -*-
from odoo import api, fields, models, tools, _

class res_users(models.Model):
    _inherit = "res.users"

    pos_config_id = fields.Many2one('pos.config', 'Pos Config')
    pos_delete_order = fields.Boolean('Delete pos orders', default=0)

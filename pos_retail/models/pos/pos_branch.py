# -*- coding: utf-8 -*-
from odoo import api, models, fields, registry
import logging

_logger = logging.getLogger(__name__)

class PosBranch(models.Model):
    _name = "pos.branch"
    _description = "Branch of shops"

    name = fields.Char('Name', required=1)
    user_id = fields.Many2one('res.users', 'Manager User', required=1)
    user_ids = fields.Many2many('res.users', 'pos_branch_res_users_rel', 'branch_id', 'user_id', string='POS Users')
    config_ids = fields.One2many('pos.config', 'pos_branch_id', string='POS Configs', readonly=1)
# -*- coding: utf-8 -*-
from odoo import api, fields, models, _
from odoo.exceptions import UserError


class pos_combo_item(models.Model):
    _inherit = "pos.combo.item"

    uom_id = fields.Many2one('uom.uom', 'Unit of measure')
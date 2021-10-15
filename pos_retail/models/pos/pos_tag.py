# -*- coding: utf-8 -*-
from odoo import models, fields, api, _

class pos_tag(models.Model):
    _name = "pos.tag"
    _description = "Management Order line tags"

    name = fields.Char('Name', required=1)
    color = fields.Integer("Color Index", default=0)
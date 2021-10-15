# -*- coding: utf-8 -*-
from odoo import api, fields, models, _

class pos_quickly_payment(models.Model):

    _name = "pos.quickly.payment"
    _description = "Quickly add money"

    name = fields.Char('Name', required=1)
    amount = fields.Float('Amount', required=1)
    active = fields.Boolean('Active', default=1)

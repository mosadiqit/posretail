# -*- coding: utf-8 -*-
from odoo import api, models, fields

class barcode_rule(models.Model):

    _inherit = "barcode.rule"

    type = fields.Selection(selection_add=[
        ('order', 'Return Order'),
        ('return_products', 'Return Products'),
        ('voucher', 'Voucher'),
        ('login_security', 'Login Security'),
        ('fast_order_number', 'Fast order number'),
    ])


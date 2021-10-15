# -*- coding: utf-8 -*-
from odoo import api, fields, models, _


class ProductVariant(models.Model):
    _inherit = "product.variant"

    uom_id = fields.Many2one('uom.uom', related='product_id.uom_id', string='Unit Link Stock', store=True, readonly=1)
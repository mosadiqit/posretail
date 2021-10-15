# -*- coding: utf-8 -*-
from odoo import api, fields, models, _
from datetime import datetime

class product_quantity_pack(models.Model):
    _name = 'product.quantity.pack'
    _rec_name = 'barcode'
    _description = "Allow pos sale product pack/combo"

    product_tmpl_id = fields.Many2one('product.template', 'Product template', required=1)
    public_price = fields.Float('Price', required=1)
    quantity = fields.Float('Quantity', required=1)
    barcode = fields.Char('Barcode')
    active = fields.Boolean('Active', default=1)

    @api.model
    def create(self, vals):
        pack = super(product_quantity_pack, self).create(vals)
        if not pack.barcode:
            format_code = "%s%s%s" % ('210', pack.id, datetime.now().strftime("%d%m%y%H%M"))
            barcode = self.env['barcode.nomenclature'].sanitize_ean(format_code)
            pack.write({'barcode': barcode})
        return pack

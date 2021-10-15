# -*- coding: utf-8 -*-
from odoo import api, fields, models, _
from datetime import datetime
from odoo.tools import DEFAULT_SERVER_DATETIME_FORMAT

import logging
_logger = logging.getLogger(__name__)

import odoo
version_info = odoo.release.version_info[0]

class stock_production_lot(models.Model):
    _inherit = 'stock.production.lot'

    barcode = fields.Char('Barcode')
    replace_product_public_price = fields.Boolean('Replace public price of product')
    public_price = fields.Float('Sale price')

    @api.model
    def create(self, vals):
        lot = super(stock_production_lot, self).create(vals)
        if not lot.barcode:
            format_code = "%s%s%s" % ('888', lot.id, datetime.now().strftime("%d%m%y%H%M"))
            code = self.env['barcode.nomenclature'].sanitize_ean(format_code)
            lot.write({'barcode': code})
        return lot

    @api.multi
    def update_ean(self, vals):
        for lot in self:
            format_code = "%s%s%s" % ('888', lot.id, datetime.now().strftime("%d%m%y%H%M"))
            code = self.env['barcode.nomenclature'].sanitize_ean(format_code)
            lot.write({'barcode': code})
        return True

    @api.multi
    def pos_create_lots(self, lots, fields_read, pos_config_name, location_id):
        inventory_obj = self.env['stock.inventory']
        inventory_line_obj = self.env['stock.inventory.line']
        values = []
        for lot_val in lots:
            lot = self.create(lot_val)
            if lot_val.get('quantity') > 0:
                if version_info == 12:
                    name = fields.Datetime.now().strftime(DEFAULT_SERVER_DATETIME_FORMAT)
                else:
                    name = fields.Datetime.now()
                inventory_adjustment = inventory_obj.create({
                    'name': 'POS %s %s' % (pos_config_name, name),
                    'filter': 'lot',
                    'lot_id': lot.id,
                    'date': fields.Datetime.now()
                })
                inventory_adjustment.action_start()
                inventory_line_obj.create({
                    'product_id': lot_val.get('product_id'),
                    'location_id': location_id,
                    'inventory_id': inventory_adjustment.id,
                    'prod_lot_id': lot.id,
                    'product_qty': lot_val.get('quantity'),
                })
                if version_info == 12:
                    inventory_adjustment.action_validate()
                else:
                    inventory_adjustment.action_done()
            values.append(lot.read(fields_read)[0])
        return values

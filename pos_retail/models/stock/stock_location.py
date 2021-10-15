# -*- coding: utf-8 -*-
from odoo import fields, api, models

import logging
import odoo

_logger = logging.getLogger(__name__)


class stock_location(models.Model):
    _inherit = "stock.location"

    @api.multi
    def pos_update_stock_on_hand_by_location_id(self, vals={}):
        wizard = self.env['stock.change.product.qty'].create(vals)
        wizard.change_product_qty()
        location = self.browse(vals.get('location_id'))
        product = self.env['product.product'].with_context({'location': location.id}).browse(vals.get('product_id'))
        return {
            'location': location.name,
            'product': product.display_name,
            'quantity': product.qty_available
        }

    def _get_child_locations(self, location_id, location_ids=[]):
        location = self.browse(location_id)
        if location.child_ids:
            location_ids = list(set(location_ids + [child.id for child in location.child_ids]))
            for child in location.child_ids:
                if child.usage == 'internal':
                    child_location_ids = self._get_child_locations(child.id, location_ids)
                    location_ids = list(set(location_ids + child_location_ids))
        return location_ids

    @api.multi
    def get_stock_datas(self, product_ids=[], location_ids=[]):
        version_info = odoo.release.version_info[0]
        stock_datas = {}
        for location_id in location_ids:
            location_ids = self._get_child_locations(location_id, location_ids)
        if len(location_ids) == 1:
            location_ids.append(0)
        if len(product_ids) == 1:
            product_ids.append(0)
        if not product_ids:
            if version_info == 10:
                sql = "SELECT product_id, qty FROM stock_quant where location_id in %s"
            else:
                sql = "SELECT product_id, quantity FROM stock_quant where location_id in %s"
            self.env.cr.execute(sql, (tuple(location_ids),))
        else:
            if version_info == 10:
                sql = "SELECT product_id, qty FROM stock_quant where location_id in %s AND product_id in %s"
            else:
                sql = "SELECT product_id, quantity FROM stock_quant where location_id in %s AND product_id in %s"
            self.env.cr.execute(sql, (tuple(location_ids), tuple(product_ids),))
        datas = self.env.cr.dictfetchall()
        for data in datas:
            if not stock_datas.get(data['product_id'], None):
                if version_info == 10:
                    stock_datas[data['product_id']] = data['qty']
                else:
                    stock_datas[data['product_id']] = data['quantity']
            else:
                if version_info == 10:
                    stock_datas[data['product_id']] += data['qty']
                else:
                    stock_datas[data['product_id']] += data['quantity']
        return stock_datas
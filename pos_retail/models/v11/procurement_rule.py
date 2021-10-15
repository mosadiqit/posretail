# -*- coding: utf-8 -*-
from odoo import models, fields, _, api
import odoo
from odoo.exceptions import UserError
from datetime import datetime
from dateutil.relativedelta import relativedelta

import logging

_logger = logging.getLogger(__name__)


class ProcurementRule(models.Model):
    _inherit = "procurement.rule"

    def _get_stock_move_values(self, product_id, product_qty, product_uom, location_id, name, origin, values, group_id):
        """
        We force location_id from POS Session stock move
        When stock move get correctly location of pos session, stock move and stock picking will have location ID the same
        """
        datas = super(ProcurementRule, self)._get_stock_move_values(product_id, product_qty, product_uom, location_id, name, origin, values, group_id)
        if values.get('location_id', None):
            datas.update({'location_id': values['location_id']})
        return datas
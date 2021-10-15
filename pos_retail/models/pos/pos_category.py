# -*- coding: utf-8 -*-
from odoo import api, models, fields, registry
import logging

_logger = logging.getLogger(__name__)

class pos_category(models.Model):
    _inherit = "pos.category"
   
    @api.model
    def create(self, vals):
        category = super(pos_category, self).create(vals)
        self.env['pos.cache.database'].insert_data(self._inherit, category.id)
        return category

    @api.multi
    def write(self, vals):
        res = super(pos_category, self).write(vals)
        for category in self:
            self.env['pos.cache.database'].insert_data(self._inherit, category.id)
        return res

    @api.multi
    def unlink(self):
        for category in self:
            self.env['pos.cache.database'].remove_record(self._inherit, category.id)
        return super(pos_category, self).unlink()

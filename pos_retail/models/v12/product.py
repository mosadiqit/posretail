# -*- coding: utf-8 -*-
from odoo import api, fields, models, _
import logging
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)

class product_template(models.Model):

    _inherit = 'product.template'

    uom_ids = fields.Many2many('uom.uom', string='Units the same category', compute='_get_uoms_the_same_category')

    @api.onchange('uom_id')
    def onchange_uom_id(self):
        if self.uom_id:
            uoms = self.env['uom.uom'].search([('category_id', '=', self.uom_id.category_id.id)])
            self.uom_ids = [(6, 0, [uom.id for uom in uoms])]

    @api.multi
    def _get_uoms_the_same_category(self):
        for product in self:
            uoms = self.env['uom.uom'].search([('category_id', '=', product.uom_id.category_id.id)])
            product.uom_ids = [(6, 0, [uom.id for uom in uoms])]


# -*- coding: utf-8 -*-

from odoo import models, fields, api, _
from odoo.addons import decimal_precision as dp
import logging

_logger = logging.getLogger(__name__)


class sale_order_line_insert(models.TransientModel):
    _name = "sale.order.line.insert"
    _description = "Insert order lines"

    name = fields.Char('Description')
    line_id = fields.Many2one('sale.order.line', 'Line', required=1)
    order_id = fields.Many2one('sale.order', 'Order', required=1)
    product_id = fields.Many2one('product.product', string='Product', domain=[('sale_ok', '=', True)])
    product_uom_qty = fields.Float(string='Quantity', digits=dp.get_precision('Product Unit of Measure'), default=1.0)
    product_uom = fields.Many2one('uom.uom', string='Unit of Measure') # v12 only
    discount = fields.Float(string='Discount (%)', digits=dp.get_precision('Discount'), default=0.0)
    price_unit = fields.Float('Unit Price', required=True, digits=dp.get_precision('Product Price'), default=0.0)
    tax_id = fields.Many2many('account.tax', string='Taxes',
                              domain=['|', ('active', '=', False), ('active', '=', True)])
    company_id = fields.Many2one('res.company', 'Company',
                                 default=lambda self: self.env['res.company']._company_default_get('sale.order'))

    @api.multi
    @api.onchange('product_id')
    def product_id_change(self):
        if not self.product_uom or (self.product_id.uom_id.id != self.product_uom.id):
            self.product_uom = self.product_id.uom_id
            self.product_uom_qty = 1.0

        product = self.product_id.with_context(
            lang=self.order_id.partner_id.lang,
            partner=self.order_id.partner_id.id,
            quantity=self.product_uom_qty,
            date=self.order_id.date_order,
            pricelist=self.order_id.pricelist_id.id,
            uom=self.product_uom.id
        )
        self._compute_tax_id()
        if self.order_id.pricelist_id and self.order_id.partner_id:
            price = self._get_display_price(product)
            self.price_unit = self.env['account.tax']._fix_tax_included_price_company(price, product.taxes_id,
                                                                                         self.tax_id, self.company_id)
        else:
            self.price_unit = product.list_price
        self.name = self.product_id.name

    def _get_display_price(self, product):
        if self.order_id.pricelist_id.discount_policy == 'with_discount':
            return product.with_context(pricelist=self.order_id.pricelist_id.id).price
        final_price, rule_id = self.order_id.pricelist_id.get_product_price_rule(self.product_id,
                                                                                 self.product_uom_qty or 1.0,
                                                                                 self.order_id.partner_id)
        context_partner = dict(self.env.context, partner_id=self.order_id.partner_id.id, date=self.order_id.date_order)
        base_price, currency_id = self.with_context(context_partner)._get_real_price_currency(self.product_id, rule_id,
                                                                                              self.product_uom_qty,
                                                                                              self.product_uom,
                                                                                              self.order_id.pricelist_id.id)
        if currency_id != self.order_id.pricelist_id.currency_id.id:
            base_price = self.env['res.currency'].browse(currency_id).with_context(context_partner).compute(base_price,
                                                                                                            self.order_id.pricelist_id.currency_id)
        return max(base_price, final_price)

    @api.multi
    def _compute_tax_id(self):
        for line in self:
            fpos = line.order_id.fiscal_position_id or line.order_id.partner_id.property_account_position_id
            taxes = line.product_id.taxes_id.filtered(lambda r: not line.company_id or r.company_id == line.company_id)
            line.tax_id = fpos.map_tax(taxes, line.product_id, line.order_id.partner_shipping_id) if fpos else taxes

    @api.multi
    def insert_line(self):
        self.ensure_one()
        vals = {
            'name': self.name if self.name else self.product_id.name,
            'parent_id': self.line_id.id,
            'order_id': self.order_id.id,
            'product_id': self.product_id.id,
            'product_uom_qty': self.product_uom_qty,
            'product_uom': self.product_uom.id,
            'discount': self.discount,
            'price_unit': self.price_unit,
            'tax_id': [(6, 0, [tax.id for tax in self.tax_id])]
        }
        self.env['sale.order.line'].create(vals)
        return {'type': 'ir.actions.act_window_close'}

# -*- coding: utf-8 -*-
from odoo import models, fields, _, api
import odoo
from odoo.exceptions import UserError
from datetime import datetime
from dateutil.relativedelta import relativedelta

import logging

_logger = logging.getLogger(__name__)


class sale_order(models.Model):
    _inherit = "sale.order"

    signature = fields.Binary('Signature', readonly=1)
    book_order = fields.Boolean('Booked Order')
    ean13 = fields.Char('Ean13 Code', readonly=1)
    pos_location_id = fields.Many2one('stock.location', 'POS Location')
    delivery_date = fields.Datetime('Delivery date')
    delivered_date = fields.Datetime('Delivered date')
    delivery_address = fields.Char('Delivery address')
    delivery_phone = fields.Char('Delivery phone', help='Phone of customer for delivery')
    payment_partial_amount = fields.Float('Payment partial amount')
    payment_partial_journal_id = fields.Many2one('account.journal', string='Payment journal')
    insert = fields.Boolean('Insert', default=0)
    state = fields.Selection(selection_add=[
        ('booked', 'Booked from POS')
    ])

    # odoo original wrong because this is api multi
    # could not use abandoned_delay = self.website_id outside of looping orders
    @api.multi
    @api.depends('team_id.team_type', 'date_order', 'order_line', 'state', 'partner_id')
    def _compute_abandoned_cart(self):
        for order in self:
            try:
                abandoned_delay = order.website_id and order.website_id.cart_abandoned_delay or 1.0
                abandoned_datetime = datetime.utcnow() - relativedelta(hours=abandoned_delay)
                domain = order.date_order and order.date_order <= abandoned_datetime and order.team_id.team_type == 'website' and order.state == 'draft' and order.partner_id.id != self.env.ref(
                    'base.public_partner').id and order.order_line
                order.is_abandoned_cart = bool(domain)
            except:
                continue

    @api.multi
    def action_validate_picking(self):
        picking_name = ''
        for sale in self:
            for picking in sale.picking_ids:
                if picking.state in ['assigned', 'waiting', 'confirmed']:
                    for move_line in picking.move_line_ids:
                        move_line.write({'qty_done': move_line.product_uom_qty})
                    for move_line in picking.move_lines:
                        move_line.write({'quantity_done': move_line.product_uom_qty})
                    picking.button_validate()
                    picking_name = picking.name
        return picking_name

    @api.model
    def pos_create_sale_order(self, vals, sale_order_auto_confirm, sale_order_auto_invoice, sale_order_auto_delivery):
        version_info = odoo.release.version_info
        for line in vals['order_line']:
            line = line[2]
            product_id = line.get('product_id')
            product = self.env['product.product'].browse(product_id)
            if product.tracking != 'none':
                if not line.get('pack_lot_ids', None):
                    raise UserError(u'Missing lot name (number) of %s' % product.name)
                else:
                    for lot_name in line.get('pack_lot_ids'):
                        lots = self.env['stock.production.lot'].sudo().search(
                            [('name', '=', lot_name), ('product_id', '=', product_id)])
                        if not lots:
                            raise UserError(u'Wrong or have not this lot name (number) of %s' % product.name)
                        else:
                            lot_id = lots[0].id
                            line['lot_id'] = lot_id
                del line['pack_lot_ids']
        sale = self.create(vals)
        sale.order_line._compute_tax_id()
        if sale_order_auto_confirm:
            sale.action_confirm()
            sale.action_done()
        if sale_order_auto_delivery and sale.picking_ids:
            for picking in sale.picking_ids:
                if version_info and version_info[0] in [11, 12]:
                    for move_line in picking.move_line_ids:
                        move_line.write({'qty_done': move_line.product_uom_qty})
                    for move_line in picking.move_lines:
                        move_line.write({'quantity_done': move_line.product_uom_qty})
                    picking.button_validate()
        if sale_order_auto_confirm and sale_order_auto_invoice:
            sale.action_invoice_create()
            for invoice in sale.invoice_ids:
                invoice.action_invoice_open()
                invoice.invoice_validate()
        return {'name': sale.name, 'id': sale.id}

    @api.model
    def booking_order(self, vals):
        so = self.create(vals)
        return {'name': so.name, 'id': so.id}

    @api.model
    def create(self, vals):
        sale = super(sale_order, self).create(vals)
        self.env['pos.cache.database'].insert_data(self._inherit, sale.id)
        if not sale.delivery_address:
            if sale.partner_shipping_id:
                sale.delivery_address = sale.partner_shipping_id.contact_address
            else:
                sale.delivery_address = sale.partner_id.contact_address
        return sale

    @api.multi
    def write(self, vals):
        res = super(sale_order, self).write(vals)
        for sale in self:
            if not sale.delivery_address:
                if sale.partner_shipping_id:
                    sale.delivery_address = sale.partner_shipping_id.contact_address
                else:
                    sale.delivery_address = sale.partner_id.contact_address
            self.env['pos.cache.database'].insert_data(self._inherit, sale.id)
        return res

    @api.multi
    def unlink(self):
        for record in self:
            self.env['pos.cache.database'].remove_record(self._inherit, record.id)
        return super(sale_order, self).unlink()


class SaleOrderLine(models.Model):
    _inherit = "sale.order.line"
    _order = 'parent_id'

    insert = fields.Boolean('Insert', default=0)
    parent_id = fields.Many2one('sale.order.line', 'Parent')
    lot_id = fields.Many2one('stock.production.lot', 'Lot')
    variant_ids = fields.Many2many('product.variant',
                                   'sale_line_variant_rel',
                                   'sale_line_id',
                                   'variant_id',
                                   string='Variants')
    pos_note = fields.Text('Booking Note')

    @api.multi
    def unlink(self):
        for record in self:
            self.env['pos.cache.database'].remove_record(self._inherit, record.id)
        return super(SaleOrderLine, self).unlink()

    @api.model
    def create(self, vals):
        line = super(SaleOrderLine, self).create(vals)
        if line.insert:
            line.order_id.write({'insert': True})
        self.env['pos.cache.database'].insert_data('sale.order', line.order_id.id)
        self.env['pos.cache.database'].insert_data(self._inherit, line.id)
        return line

    @api.multi
    def write(self, vals):
        res = super(SaleOrderLine, self).write(vals)
        for line in self:
            self.env['pos.cache.database'].insert_data(self._inherit, line.id)
        return res

    @api.multi
    def insert_line(self):
        self.ensure_one()
        vals = {
            'order_id': self.order_id.id,
            'line_id': self.id,
        }
        wiz = self.env['sale.order.line.insert'].create(vals)
        return {
            'name': "Insert line",
            'view_mode': 'form',
            'view_id': False,
            'view_type': 'form',
            'res_model': 'sale.order.line.insert',
            'res_id': wiz.id,
            'type': 'ir.actions.act_window',
            'nodestroy': True,
            'target': 'new',
        }

    @api.multi
    def _prepare_procurement_values(self, group_id=False):
        values = super(SaleOrderLine, self)._prepare_procurement_values(group_id)
        if self.order_id.pos_location_id:
            values.update({'location_id': self.order_id.pos_location_id.id})
        return values

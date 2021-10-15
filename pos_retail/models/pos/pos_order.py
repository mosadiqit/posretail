# -*- coding: utf-8 -*-
from odoo import api, fields, models, tools, _, registry
from odoo.tools import DEFAULT_SERVER_DATETIME_FORMAT
import odoo
import logging
import openerp.addons.decimal_precision as dp
from odoo.exceptions import UserError
from datetime import datetime, timedelta
import threading

_logger = logging.getLogger(__name__)


class pos_order(models.Model):
    _inherit = "pos.order"

    picking_ids = fields.One2many('stock.picking', 'pos_order_id', 'Delivery Orders')
    promotion_ids = fields.Many2many('pos.promotion',
                                     'pos_order_promotion_rel',
                                     'order_id',
                                     'promotion_id',
                                     string='Promotions')
    ean13 = fields.Char('Ean13', readonly=1)
    expire_date = fields.Datetime('Expired date')
    is_return = fields.Boolean('Is return')
    add_credit = fields.Boolean('Add credit')
    lock_return = fields.Boolean('Lock return')
    return_order_id = fields.Many2one('pos.order', 'Return of order')
    email = fields.Char('Email')
    email_invoice = fields.Boolean('Email invoice')
    plus_point = fields.Float('Plus point', readonly=1)
    redeem_point = fields.Float('Redeem point', readonly=1)
    signature = fields.Binary('Signature', readonly=1)
    parent_id = fields.Many2one('pos.order', 'Parent Order', readonly=1)
    create_voucher = fields.Boolean('Credit voucher', readonly=1)
    partial_payment = fields.Boolean('Partial Payment')
    state = fields.Selection(selection_add=[
        ('partial_payment', 'Partial Payment')
    ])
    medical_insurance_id = fields.Many2one('medical.insurance', 'Medical insurance')
    margin = fields.Float(
        'Margin', compute='_compute_margin', store=True,
        digits=dp.get_precision('Product Price'))
    lines = fields.One2many('pos.order.line', 'order_id', string='Order Lines',
                            states={'draft': [('readonly', False)], 'partial_payment': [('readonly', False)]},
                            readonly=True, copy=True)
    sale_id = fields.Many2one('sale.order', 'Sale order', readonly=1)
    booking_id = fields.Many2one('sale.order', 'Booking Order',
                                 help='This order covert from booking (quotation/sale) order', readonly=1)
    sale_journal = fields.Many2one('account.journal', string='Sales Journal', readonly=0, related=None, )
    location_id = fields.Many2one('stock.location', string="Location", required=True, related=None, readonly=0)
    pos_branch_id = fields.Many2one('pos.branch', string='Branch', readonly=1)
    is_push_order_no_wait = fields.Boolean('Is Order no Wait')
    currency_id = fields.Many2one('res.currency', string='Currency', readonly=1, related=False)

    @api.multi
    @api.depends('lines.margin')
    def _compute_margin(self):
        for order in self:
            order.margin = sum(order.mapped('lines.margin'))

    @api.multi
    def unlink(self):
        for record in self:
            self.env['pos.cache.database'].remove_record(self._inherit, record.id)
        return super(pos_order, self).unlink()

    @api.multi
    def write(self, vals):
        res = super(pos_order, self).write(vals)
        for order in self:
            if vals.get('picking_id', None):
                # TODO: we linked picking  to pos order
                self.env.cr.execute(
                    "UPDATE stock_picking SET pos_order_id=%s WHERE id=%s" % (order.id, vals.get('picking_id')))
            if vals.get('state', False) == 'paid':
                for line in order.lines:  # TODO active vouchers for customers can use, required paid done
                    self.env.cr.execute(
                        "UPDATE pos_voucher SET state='active' WHERE pos_order_line_id=%s" % (line.id))
                order.pos_compute_loyalty_point()
            if order.partner_id:  # TODO sync credit, wallet balance to pos sessions
                self.env['pos.cache.database'].insert_data('res.partner', order.partner_id.id)
            self.env['pos.cache.database'].insert_data(self._inherit, order.id)
            if order.partner_id:
                pos_total_amount = 0
                for order_bought in order.partner_id.pos_order_ids:
                    pos_total_amount += order_bought.amount_total
                type_will_add = self.env['res.partner.type'].get_type_from_total_amount(pos_total_amount)
                if not type_will_add:
                    type_will_add = 'Null'
                self.env.cr.execute(
                    "UPDATE res_partner SET pos_partner_type_id=%s, pos_total_amount=%s WHERE id=%s" % (
                        type_will_add, pos_total_amount, order.partner_id.id))
        return res

    @api.model
    def create(self, vals):
        session = self.env['pos.session'].browse(vals.get('session_id'))
        SaleOrder = self.env['sale.order'].sudo()
        if not vals.get('location_id', None):
            vals.update({
                'location_id': session.config_id.stock_location_id.id if session.config_id.stock_location_id else None
            })
        else:
            location = self.env['stock.location'].browse(vals.get('location_id'))
            location_company = location.company_id
            if not location_company or location_company.id != self.env.user.company_id.id:
                vals.update({
                    'location_id': session.config_id.stock_location_id.id if session.config_id.stock_location_id else None
                })
        if not vals.get('sale_journal', None):
            vals.update({'sale_journal': session.config_id.journal_id.id})
        if session.config_id.pos_branch_id:
            vals.update({'pos_branch_id': session.config_id.pos_branch_id.id})
        order = super(pos_order, self).create(vals)
        if vals.get('partial_payment', False):
            order.write({'state': 'partial_payment'})
        if order.create_voucher:
            self.env['pos.voucher'].create_voucher(order)
        if vals.get('booking_id', False):
            SaleOrder.browse(vals.get('booking_id')).write({'state': 'booked'})
        if vals.get('sale_id', False):
            SaleOrder.browse(vals.get('sale_id')).write({'state': 'done'})
        self.env['pos.cache.database'].insert_data(self._inherit, order.id)
        return order

    @api.multi
    def action_pos_order_send(self):
        if not self.partner_id:
            raise Warning(_('Customer not found on this Point of Sale Orders.'))
        self.ensure_one()
        template = self.env.ref('pos_retail.email_template_edi_pos_orders', False)
        compose_form = self.env.ref('mail.email_compose_message_wizard_form', False)
        ctx = dict(
            default_model='pos.order',
            default_res_id=self.id,
            default_use_template=bool(template),
            default_template_id=template and template.id or False,
            default_composition_mode='comment',
        )
        return {
            'name': _('Compose Email'),
            'type': 'ir.actions.act_window',
            'view_type': 'form',
            'view_mode': 'form',
            'res_model': 'mail.compose.message',
            'views': [(compose_form.id, 'form')],
            'view_id': compose_form.id,
            'target': 'new',
            'context': ctx,
        }

    def _prepare_invoice(self):
        values = super(pos_order, self)._prepare_invoice()
        values.update({
            'pos_order_id': self.id,
            'journal_id': self.sale_journal.id
        })
        return values

    @api.one
    def made_invoice(self):
        self.action_pos_order_invoice()
        self.invoice_id.sudo().action_invoice_open()
        self.account_move = self.invoice_id.move_id
        return {
            'id': self.invoice_id.id,
            'number': self.invoice_id.number
        }

    def add_payment(self, data):
        # v12 check data have currency_id, will check company currency and line currency
        # if have not difference could not create
        if data.get('currency_id', False):
            currency = self.env['res.currency'].browse(data.get('currency_id'))
            if currency == self.env.user.company_id.currency_id:
                del data['currency_id']
                del data['amount_currency']
        res = super(pos_order, self).add_payment(data)
        self.env['pos.cache.database'].insert_data(self._inherit, self.id)
        return res

    def _action_create_invoice_line(self, line=False, invoice_id=False):
        # when cashiers change tax on pos order line (pos screen)
        # map pos.order.line to account.invoice.line
        # map taxes of pos.order.line to account.invoice.line
        inv_line = super(pos_order, self)._action_create_invoice_line(line, invoice_id)
        vals = {
            'pos_line_id': line.id
        }
        if not line.order_id.fiscal_position_id:
            tax_ids = [tax.id for tax in line.tax_ids]
            vals.update({
                'invoice_line_tax_ids': [(6, 0, tax_ids)]
            })
        if line.uom_id:
            vals.update({
                'uom_id': line.uom_id.id
            })
        inv_line.write(vals)
        return inv_line

    # create 1 purchase get products return from customer
    def made_purchase_order(self):
        customer_return = self.env['res.partner'].search([('name', '=', 'Customer return')])
        po = self.env['purchase.order'].create({
            'partner_id': self.partner_id.id if self.partner_id else customer_return[0].id,
            'name': 'Return/' + self.name,
        })
        for line in self.lines:
            if line.qty < 0:
                self.env['purchase.order.line'].create({
                    'order_id': po.id,
                    'name': 'Return/' + line.product_id.name,
                    'product_id': line.product_id.id,
                    'product_qty': - line.qty,
                    'product_uom': line.product_id.uom_po_id.id,
                    'price_unit': line.price_unit,
                    'date_planned': datetime.today().strftime(DEFAULT_SERVER_DATETIME_FORMAT),
                })
        po.button_confirm()
        for picking in po.picking_ids:
            picking.action_assign()
            picking.force_assign()
            wrong_lots = self.set_pack_operation_lot(picking)
            if not wrong_lots:
                picking.action_done()
        return True

    @api.multi
    def set_done(self):
        for order in self:
            order.write({'state': 'done'})

    @api.model
    def _order_fields(self, ui_order):
        order_fields = super(pos_order, self)._order_fields(ui_order)
        if ui_order.get('add_credit', False):
            order_fields.update({
                'add_credit': ui_order['add_credit']
            })
        if ui_order.get('medical_insurance_id', False):
            order_fields.update({
                'medical_insurance_id': ui_order['medical_insurance_id']
            })
        if ui_order.get('partial_payment', False):
            order_fields.update({
                'partial_payment': ui_order['partial_payment']
            })
        if ui_order.get('sale_id', False):
            order_fields.update({
                'sale_id': ui_order['sale_id']
            })
        if ui_order.get('delivery_date', False):
            order_fields.update({
                'delivery_date': ui_order['delivery_date']
            })
        if ui_order.get('delivery_address', False):
            order_fields.update({
                'delivery_address': ui_order['delivery_address']
            })
        if ui_order.get('parent_id', False):
            order_fields.update({
                'parent_id': ui_order['parent_id']
            })
        if ui_order.get('sale_journal', False):
            order_fields['sale_journal'] = ui_order.get('sale_journal')
        if ui_order.get('ean13', False):
            order_fields.update({
                'ean13': ui_order['ean13']
            })
        if ui_order.get('expire_date', False):
            order_fields.update({
                'expire_date': ui_order['expire_date']
            })
        if ui_order.get('is_return', False):
            order_fields.update({
                'is_return': ui_order['is_return']
            })
        if ui_order.get('email', False):
            order_fields.update({
                'email': ui_order.get('email')
            })
        if ui_order.get('email_invoice', False):
            order_fields.update({
                'email_invoice': ui_order.get('email_invoice')
            })
        if ui_order.get('create_voucher', False):
            order_fields.update({
                'create_voucher': ui_order.get('create_voucher')
            })
        if ui_order.get('plus_point', 0):
            order_fields.update({
                'plus_point': ui_order['plus_point']
            })
        if ui_order.get('redeem_point', 0):
            order_fields.update({
                'redeem_point': ui_order['redeem_point']
            })
        if ui_order.get('note', None):
            order_fields.update({
                'note': ui_order['note']
            })
        if ui_order.get('return_order_id', False):
            order_fields.update({
                'return_order_id': ui_order['return_order_id']
            })
        if ui_order.get('location_id', False):
            order_fields.update({
                'location_id': ui_order['location_id']
            })
        if ui_order.get('booking_id', False):
            order_fields.update({
                'booking_id': ui_order['booking_id']
            })
        if ui_order.get('currency_id', False):
            order_fields.update({
                'currency_id': ui_order['currency_id']
            })
        return order_fields

    @api.model
    def get_code(self, code):
        return self.env['barcode.nomenclature'].sudo().sanitize_ean(code)

    def _action_create_invoice_line_return(self, line=False, invoice_id=False):
        InvoiceLine = self.env['account.invoice.line']
        inv_name = line.product_id.name_get()[0][1]
        inv_line = {
            'invoice_id': invoice_id,
            'product_id': line.product_id.id,
            'quantity': - line.qty,
            'account_analytic_id': self._prepare_analytic_account(line),
            'name': inv_name,
        }
        if line.qty < 0:
            inv_line['qty'] = - line.qty
        else:
            inv_line['qty'] = line.qty
        invoice_line = InvoiceLine.sudo().new(inv_line)
        invoice_line._onchange_product_id()
        invoice_line.invoice_line_tax_ids = invoice_line.invoice_line_tax_ids.filtered(
            lambda t: t.company_id.id == line.order_id.company_id.id).ids
        fiscal_position_id = line.order_id.fiscal_position_id
        if fiscal_position_id:
            invoice_line.invoice_line_tax_ids = fiscal_position_id.map_tax(invoice_line.invoice_line_tax_ids,
                                                                           line.product_id, line.order_id.partner_id)
        invoice_line.invoice_line_tax_ids = invoice_line.invoice_line_tax_ids.ids
        inv_line = invoice_line._convert_to_write({name: invoice_line[name] for name in invoice_line._cache})
        inv_line.update(price_unit=line.price_unit, discount=line.discount, name=inv_name)
        return InvoiceLine.sudo().create(inv_line)

    @api.model
    def create_from_ui(self, orders):
        _logger.info('BEGIN create_from_ui %s' % self.env.user.login)
        order_to_invoice = []
        queue_order_ids = []
        push_order_no_wait = False
        for o in orders:
            data = o['data']
            self.env.cr.execute(
                "SELECT count(id) FROM pos_order where pos_reference='%s' and amount_total != %s" % (
                data['name'], data['amount_total']))
            total_orders = self.env.cr.fetchall()
            if total_orders[0] and total_orders[0][0] != 0:
                data['name'] = data['name'] + '-Duplicate'
            pos_session_id = data['pos_session_id']
            config = self.env['pos.session'].browse(pos_session_id).config_id
            to_invoice = o.get('to_invoice', False)
            if to_invoice and not data.get('partner_id', None):
                raise UserError(_('Please provide a partner for the sale.'))
            if to_invoice and data.get('partner_id', None) and config.invoice_offline:
                o['to_invoice'] = False
                order_to_invoice.append(data.get('name'))
            lines = data.get('lines')
            for line_val in lines:
                line = line_val[2]
                new_line = {}
                for key, value in line.items():
                    if key not in [
                        'creation_time',
                        'mp_dirty',
                        'mp_skip',
                        'quantity_wait',
                        'state',
                        'tags',
                        'quantity_done',
                        'promotion_discount_total_order',
                        'promotion_discount_category',
                        'promotion_discount_by_quantity',
                        'promotion_discount',
                        'promotion_gift',
                        'promotion_price_by_quantity']:
                        new_line[key] = value
                line_val[2] = new_line
            if config.push_order_no_wait:
                push_order_no_wait = True
                if to_invoice:
                    self._match_payment_to_invoice(data)
                queue_order_ids.append(self._process_order(data).id)
        if push_order_no_wait:
            self.browse(queue_order_ids).write({'is_push_order_no_wait': True})
            return queue_order_ids
        order_ids = super(pos_order, self).create_from_ui(orders)
        pos_orders = self.browse(order_ids)
        for order in pos_orders:
            order.pos_compute_loyalty_point()
            order.create_picking_variants()
            order.create_picking_combo()
            """
                * auto send email and receipt to customers
            """
            invoices = self.env['account.invoice'].search([('origin', '=', order.name)])
            if order.email and order.email_invoice and invoices:
                for inv in invoices:
                    inv.send_email_invoice(order)
            if order.add_credit and order.amount_total < 0:
                order.add_credit(- order.amount_total)
            if order.partner_id and order.config_id.invoice_offline and order.pos_reference in order_to_invoice:
                self.env.cr.commit()
                threaded_synchronization = threading.Thread(target=self.auto_invoice, args=(
                    order.id, []))
                threaded_synchronization.start()
            if order.partner_id and not order.config_id.invoice_offline and order.config_id.auto_register_payment:
                self.env.cr.commit()
                threaded_synchronization = threading.Thread(target=self.auto_auto_register_payment_invoice, args=(
                    order.id, []))
                threaded_synchronization.start()
        return order_ids

    @api.multi
    def cron_auto_process_orders_no_wait(self):
        orders = self.search([('is_push_order_no_wait', '=', True), ('state', '=', 'draft')])
        if len(orders):
            for order in orders:
                try:
                    _logger.info('====> Cron processing Order ID %s' % order.id)
                    order.action_pos_order_paid()
                    order.pos_compute_loyalty_point()
                    order.create_picking_variants()
                    order.create_picking_combo()
                    if order.add_credit and order.amount_total < 0:
                        order.add_credit(- order.amount_total)
                    self.env.cr.commit()
                except:
                    _logger.error('====> Cron could not process Order ID %s' % order.id)
                    continue
        return True

    @api.multi
    def auto_invoice(self, order_id, auto=False):
        with api.Environment.manage():
            """
                Auto Invoice for Order
            """
            new_cr = registry(self._cr.dbname).cursor()
            self = self.with_env(self.env(cr=new_cr))
            pos_order = self.browse(order_id)
            pos_order.action_pos_order_invoice()
            pos_order.invoice_id.sudo().action_invoice_open()
            pos_order.account_move = pos_order.invoice_id.move_id
            new_cr.commit()
            new_cr.close()
        return True

    @api.multi
    def auto_auto_register_payment_invoice(self, order_id, order_ids=[]):
        with api.Environment.manage():
            """
                * auto reconcile invoice if auto_register_payment checked on pos config
            """
            new_cr = registry(self._cr.dbname).cursor()
            self = self.with_env(self.env(cr=new_cr))
            pos_order = self.browse(order_id)
            pos_order.pos_order_auto_invoice_reconcile()
            new_cr.commit()
            new_cr.close()
        return True

    @api.multi
    def action_pos_order_paid(self):
        orders = self.filtered(lambda x: not x.partial_payment)
        partial_orders = self.filtered(lambda x: x.partial_payment)
        if orders:
            super(pos_order, orders).action_pos_order_paid()
        if partial_orders:
            for order in partial_orders:
                if order.test_paid():
                    order.write({'state': 'paid'})
                else:
                    order.write({'state': 'partial_payment'})
                if not order.picking_id:
                    order.create_picking()

    def pos_compute_loyalty_point(self):
        if self.partner_id and self.config_id and self.config_id.loyalty_id and (self.redeem_point or self.plus_point):
            self.env.cr.execute("select id from pos_loyalty_point where order_id=%s and type='plus'" % self.id)
            have_plus = self.env.cr.fetchall()
            self.env.cr.execute("select id from pos_loyalty_point where order_id=%s and type='redeem'" % self.id)
            have_redeem = self.env.cr.fetchall()
            vals_point = {
                'loyalty_id': self.config_id.loyalty_id.id,
                'order_id': self.id,
                'partner_id': self.partner_id.id,
                'state': 'ready',
                'is_return': self.is_return if self.is_return else False,
            }
            if self.plus_point and len(have_plus) == 0:
                vals_point.update({
                    'point': self.plus_point,
                    'type': 'plus'
                })
                self.env['pos.loyalty.point'].create(vals_point)
            if self.redeem_point and len(have_redeem) == 0:
                vals_point.update({
                    'point': self.redeem_point,
                    'type': 'redeem'
                })
                self.env['pos.loyalty.point'].create(vals_point)

    @api.model
    def add_credit(self, amount):
        """
            * create credit note for return order
        """

        if self.partner_id:
            credit_object = self.env['res.partner.credit']
            credit = credit_object.create({
                'name': self.name,
                'type': 'plus',
                'amount': amount,
                'pos_order_id': self.id,
                'partner_id': self.partner_id.id,
            })
            return self.env['pos.cache.database'].insert_data('res.partner', credit.partner_id.id)
        else:
            return False

    @api.multi
    def pos_order_auto_invoice_reconcile(self):
        version_info = odoo.release.version_info
        if version_info and version_info[0] in [11, 12]:
            for order_obj in self:
                if order_obj.invoice_id:
                    moves = self.env['account.move']
                    statements_line_ids = order_obj.statement_ids
                    for st_line in statements_line_ids:
                        if st_line.account_id and not st_line.journal_entry_ids.ids:
                            st_line.fast_counterpart_creation()
                        elif not st_line.journal_entry_ids.ids and not st_line.currency_id.is_zero(st_line.amount):
                            break
                        for aml in st_line.journal_entry_ids:
                            moves |= aml.move_id
                        if moves:
                            moves.filtered(lambda m: m.state != 'posted').post()
                        for move in moves:
                            for line_id in move.line_ids:
                                if line_id.credit_cash_basis > 0:
                                    not line_id.reconciled and order_obj.invoice_id.assign_outstanding_credit(
                                        line_id.id)
        return True

    def create_picking_combo(self):
        lines_included_combo_items = self.lines.filtered(
            lambda l: len(l.combo_item_ids) > 0)
        if lines_included_combo_items:
            _logger.info('Start create_picking_combo()')
            warehouse_obj = self.env['stock.warehouse']
            move_object = self.env['stock.move']
            moves = move_object
            picking_obj = self.env['stock.picking']
            picking_type = self.picking_type_id
            location_id = self.location_id.id
            if self.partner_id:
                destination_id = self.partner_id.property_stock_customer.id
            else:
                if (not picking_type) or (not picking_type.default_location_dest_id):
                    customerloc, supplierloc = warehouse_obj._get_partner_locations()
                    destination_id = customerloc.id
                else:
                    destination_id = picking_type.default_location_dest_id.id
            is_return = self.is_return
            name = self.name
            if is_return:
                name += '- Return Combo'
            else:
                name += '- Combo'
            picking_vals = {
                'name': name,
                'origin': self.name,
                'partner_id': self.partner_id.id if self.partner_id else None,
                'date_done': self.date_order,
                'picking_type_id': picking_type.id,
                'company_id': self.company_id.id,
                'move_type': 'direct',
                'note': self.note or "",
                'location_id': location_id if not is_return else destination_id,
                'location_dest_id': destination_id if not is_return else location_id,
                'pos_order_id': self.id,
            }
            picking_combo = picking_obj.create(picking_vals)
            for order_line in lines_included_combo_items:
                for combo_item in order_line.combo_item_ids:
                    product = combo_item.product_id
                    order_line_qty = order_line.qty
                    move = move_object.create({
                        'name': self.name,
                        'product_uom': product.uom_id.id,
                        'picking_id': picking_combo.id,
                        'picking_type_id': picking_type.id,
                        'product_id': product.id,
                        'product_uom_qty': abs(combo_item.quantity * order_line_qty),
                        'state': 'draft',
                        'location_id': location_id if not is_return else destination_id,
                        'location_dest_id': destination_id if not is_return else location_id,
                    })
                    moves |= move
            self._force_picking_done(picking_combo)
        return True

    def create_picking_variants(self):
        lines_included_variants = self.lines.filtered(
            lambda l: len(l.variant_ids) > 0)
        required_create_picking = False
        for line in lines_included_variants:
            if required_create_picking:
                break
            for combo_item in line.combo_item_ids:
                if combo_item.product_id and combo_item.product_id.type == 'product':
                    required_create_picking = True
                    break
        if lines_included_variants and required_create_picking:
            _logger.info('begin create_picking_variants')
            warehouse_obj = self.env['stock.warehouse']
            move_object = self.env['stock.move']
            moves = move_object
            picking_obj = self.env['stock.picking']
            picking_type = self.picking_type_id
            location_id = self.location_id.id
            if self.partner_id:
                destination_id = self.partner_id.property_stock_customer.id
            else:
                if (not picking_type) or (not picking_type.default_location_dest_id):
                    customerloc, supplierloc = warehouse_obj._get_partner_locations()
                    destination_id = customerloc.id
                else:
                    destination_id = picking_type.default_location_dest_id.id
            is_return = self.is_return
            picking_vals = {
                'name': self.name + '- Variants',
                'origin': self.name,
                'partner_id': self.partner_id.id if self.partner_id else None,
                'date_done': self.date_order,
                'picking_type_id': picking_type.id,
                'company_id': self.company_id.id,
                'move_type': 'direct',
                'note': self.note or "",
                'location_id': location_id if not is_return else destination_id,
                'location_dest_id': destination_id if not is_return else location_id,
                'pos_order_id': self.id,
            }
            picking_variants = picking_obj.create(picking_vals)
            for order_line in lines_included_variants:
                for variant_item in order_line.variant_ids:
                    if not variant_item.product_id:
                        continue
                    product = variant_item.product_id
                    order_line_qty = order_line.qty
                    move = move_object.create({
                        'name': self.name,
                        'product_uom': product.uom_id.id,
                        'picking_id': picking_variants.id,
                        'picking_type_id': picking_type.id,
                        'product_id': product.id,
                        'product_uom_qty': abs(variant_item.quantity * order_line_qty),
                        'state': 'draft',
                        'location_id': location_id if not is_return else destination_id,
                        'location_dest_id': destination_id if not is_return else location_id,
                    })
                    moves |= move
            self._force_picking_done(picking_variants)
        return True

    def create_picking_return(self, origin='',
                              partner_id=None, picking_type_id=None, location_dest_id=None,
                              note='', pos_order_id=None, lines=[]):
        warehouse_obj = self.env['stock.warehouse']
        move_object = self.env['stock.move']
        moves = move_object
        picking_obj = self.env['stock.picking']
        customerloc, supplierloc = warehouse_obj._get_partner_locations()
        location_id = customerloc.id
        picking_vals = {
            'origin': origin,
            'partner_id': partner_id,
            'picking_type_id': picking_type_id,
            'company_id': self.env.user.company_id.id,
            'move_type': 'direct',
            'note': note,
            'location_id': location_id,
            'location_dest_id': location_dest_id,
            'pos_order_id': pos_order_id,
        }
        picking = picking_obj.create(picking_vals)
        for line in lines:
            if not line.get('uom_id', None):
                line.update({'product_uom': self.env['product.product'].browse(line['product_id']).uom_id.id})
            line.update({'location_id': location_id})
            line.update({'picking_id': picking.id})
            moves |= move_object.create(line)
        return self.env['pos.order'].browse(pos_order_id)._force_picking_done(picking)

    def create_stock_move_with_lot(self, stock_move=None, lot_name=None):
        """set lot serial combo items"""
        """Set Serial/Lot number in pack operations to mark the pack operation done."""
        version_info = odoo.release.version_info
        if version_info and version_info[0] in [11, 12]:
            stock_production_lot = self.env['stock.production.lot']
            lots = stock_production_lot.search([('name', '=', lot_name)])
            if lots:
                self.env['stock.move.line'].create({
                    'move_id': stock_move.id,
                    'product_id': stock_move.product_id.id,
                    'product_uom_id': stock_move.product_uom.id,
                    'qty_done': stock_move.product_uom_qty,
                    'location_id': stock_move.location_id.id,
                    'location_dest_id': stock_move.location_dest_id.id,
                    'lot_id': lots[0].id,
                })
        return True

    def _payment_fields(self, ui_paymentline):
        payment_fields = super(pos_order, self)._payment_fields(ui_paymentline)
        if ui_paymentline.get('currency_id', None):
            payment_fields['currency_id'] = ui_paymentline.get('currency_id')
        if ui_paymentline.get('amount_currency', None):
            payment_fields['amount_currency'] = ui_paymentline.get('amount_currency')
        if ui_paymentline.get('voucher_id', None):
            payment_fields['voucher_id'] = ui_paymentline.get('voucher_id')
        return payment_fields

    # wallet rebuild partner for account statement line
    # default of odoo, if one partner have childs
    # and we're choose child
    # odoo will made account bank statement to parent, not child
    # what is that ??? i dont know reasons
    def _prepare_bank_statement_line_payment_values(self, data):
        version_info = odoo.release.version_info[0]
        datas = super(pos_order, self)._prepare_bank_statement_line_payment_values(data)
        order_id = self.id
        if datas.get('journal_id', False):
            journal = self.env['account.journal'].search([('id', '=', datas['journal_id'])])
            if journal and journal[0] and (journal.pos_method_type == 'wallet') and self.partner_id:
                datas.update({'partner_id': self.partner_id.id})
        if data.get('currency_id', None):
            datas['currency_id'] = data['currency_id']
        if data.get('amount_currency', None):
            datas['amount_currency'] = data['amount_currency']
        if data.get('payment_name', False) == 'return' and version_info != 12:
            datas.update({
                'currency_id': self.env.user.company_id.currency_id.id if self.env.user.company_id.currency_id else None,
                'amount_currency': data['amount']
            })
        journal_id = datas.get('journal_id')
        if journal_id and order_id and self.partner_id and self.partner_id.id != datas[
            'partner_id']:  # if customer use wallet, and customer have parent , we're reject default odoo map parent partner to payment line
            journal = self.env['account.journal'].browse(journal_id)
            if journal.pos_method_type == 'wallet':
                datas['partner_id'] = self.partner_id.id
        if data.get('voucher_id', None):
            datas['voucher_id'] = data['voucher_id']
        return datas


class pos_order_line(models.Model):
    _inherit = "pos.order.line"

    plus_point = fields.Float('Plus Point', readonly=1)
    redeem_point = fields.Float('Redeem Point', readonly=1)
    partner_id = fields.Many2one('res.partner', related='order_id.partner_id', string='Partner', readonly=1)
    promotion = fields.Boolean('Promotion', readonly=1)
    promotion_reason = fields.Char(string='Promotion Reason', readonly=1)
    is_return = fields.Boolean('Is Return')
    combo_item_ids = fields.Many2many('pos.combo.item',
                                      'order_line_combo_item_rel',
                                      'line_id', 'combo_id',
                                      string='Combo Items', readonly=1)
    order_uid = fields.Text('order_uid', readonly=1)
    user_id = fields.Many2one('res.users', 'Sale Person')
    session_info = fields.Text('session_info', readonly=1)
    uid = fields.Text('uid', readonly=1)
    variant_ids = fields.Many2many('product.variant',
                                   'order_line_variant_rel',
                                   'line_id', 'variant_id',
                                   string='Variant Items', readonly=1)
    tag_ids = fields.Many2many('pos.tag',
                               'pos_order_line_tag_rel',
                               'line_id',
                               'tag_id',
                               string='Tags')
    note = fields.Text('Note')
    discount_reason = fields.Char('Discount Reason')
    medical_insurance = fields.Boolean('Discount Medical Insurance')
    margin = fields.Float(
        'Margin', compute='_compute_multi_margin', store=True,
        multi='multi_margin', digits=dp.get_precision('Product Price'))
    purchase_price = fields.Float(
        'Cost Price', compute='_compute_multi_margin', store=True,
        multi='multi_margin', digits=dp.get_precision('Product Price'))
    reward_id = fields.Many2one('pos.loyalty.reward', 'Reward')
    packaging_id = fields.Many2one('product.packaging', string='Package/Box')
    config_id = fields.Many2one('pos.config', related='order_id.session_id.config_id', string="Point of Sale")
    pos_branch_id = fields.Many2one('pos.branch', string='Branch', readonly=1)
    manager_user_id = fields.Many2one('res.users', 'Manager Approved')

    @api.multi
    @api.depends('product_id', 'qty', 'price_subtotal')
    def _compute_multi_margin(self):
        for line in self:
            if not line.product_id:
                line.purchase_price = 0
                line.margin = 0
            else:
                line.purchase_price = line.product_id.standard_price
                line.margin = line.price_subtotal - (
                        line.product_id.standard_price * line.qty)

    @api.model
    def create(self, vals):
        voucher_val = {}
        if vals.get('voucher', {}):
            voucher_val = vals.get('voucher')
            del vals['voucher']
        if vals.get('mp_skip', {}):
            del vals['mp_skip']
        if 'voucher' in vals:
            del vals['voucher']
        order = self.env['pos.order'].browse(vals['order_id'])
        if order.pos_branch_id:
            vals.update({'pos_branch_id': order.pos_branch_id.id})
        po_line = super(pos_order_line, self).create(vals)
        if voucher_val:
            today = datetime.today()
            if voucher_val.get('period_days', None):
                end_date = today + timedelta(days=voucher_val['period_days'])
            else:
                end_date = today + timedelta(days=order.config_id.expired_days_voucher)
            self.env['pos.voucher'].sudo().create({
                'number': voucher_val.get('number', None) if voucher_val.get('number', None) else '',
                'customer_id': order.partner_id and order.partner_id.id if order.partner_id else None,
                'start_date': fields.Datetime.now(),
                'end_date': end_date,
                'state': 'active',
                'value': po_line.price_subtotal_incl,
                'apply_type': voucher_val.get('apply_type', None) if voucher_val.get('apply_type',
                                                                                     None) else 'fixed_amount',
                'method': voucher_val.get('method', None) if voucher_val.get('method', None) else 'general',
                'source': order.name,
                'pos_order_line_id': po_line.id
            })
        if po_line.product_id.is_credit:
            po_line.order_id.add_credit(po_line.price_subtotal_incl)
        self.env['pos.cache.database'].insert_data(self._inherit, po_line.id)
        return po_line

    @api.model
    def write(self, vals):
        res = super(pos_order_line, self).write(vals)
        for po_line in self:
            self.env['pos.cache.database'].insert_data(self._inherit, po_line.id)
        return res

    @api.multi
    def unlink(self):
        for record in self:
            self.env['pos.cache.database'].remove_record(self._inherit, record.id)
        return super(pos_order_line, self).unlink()

    def get_purchased_lines_histories_by_partner_id(self, partner_id):
        orders = self.env['pos.order'].sudo().search([('partner_id', '=', partner_id)], order='create_date DESC')
        fields_sale_load = self.env['pos.cache.database'].sudo().get_fields_by_model('pos.order.line')
        vals = []
        if orders:
            order_ids = [order.id for order in orders]
            lines = self.sudo().search([('order_id', 'in', order_ids)])
            return lines.read(fields_sale_load)
        else:
            return vals

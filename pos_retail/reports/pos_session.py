# -*- coding: utf-8 -*-
from odoo import fields, models, api, SUPERUSER_ID, _
from odoo.tools import DEFAULT_SERVER_DATETIME_FORMAT

import logging
import pytz
from datetime import datetime, date, timedelta
from pytz import timezone, UTC

_logger = logging.getLogger(__name__)

import odoo

version_info = odoo.release.version_info[0]


class pos_session(models.Model):
    _inherit = "pos.session"

    @api.multi
    def get_pos_name(self):
        if self and self.config_id:
            return self.config_id.name

    def build_sessions_report(self):
        vals = {}
        for session in self:
            session_report = {}
            session_report['session'] = self.sudo().search_read([('id', '=', session.id)], [])[0]
            session_report['name'] = session.name
            session_report['date'] = session.get_current_date()
            session_report['time'] = session.get_current_time()
            session_report['state'] = session.state
            session_report['start_at'] = session.get_session_date(session.start_at)
            session_report['stop_at'] = session.get_session_date(session.stop_at)
            session_report['user_id'] = session.user_id.name
            session_report['cash_register_balance_start'] = session.cash_register_balance_start
            session_report['sales_total'] = session.get_total_sales()
            session_report['taxes'] = session.get_vat_tax()
            session_report['taxes_total'] = session.get_vat_tax()
            session_report['discounts_total'] = session.get_total_discount()
            session_report['gross_total'] = session.get_total_first()
            session_report['gross_profit_total'] = session.get_gross_total()
            session_report['net_gross_total'] = session.get_net_gross_total()
            session_report['cash_register_balance_end_real'] = session.cash_register_balance_end_real
            session_report['closing_total'] = session.get_total_closing()
            session_report['journals_amount'] = session.get_journal_amount()
            session_report['cashs_in'] = session.get_cash_in()
            session_report['cashs_out'] = session.get_cash_out()
            vals[session.id] = session_report
        return vals

    def get_cash_in(self):
        values = []
        account_bank_statement_lines = self.env['account.bank.statement.line'].search([
            ('pos_session_id', '=', self.id),
            ('pos_cash_type', '=', 'in')
        ])
        for line in account_bank_statement_lines:
            values.append({
                'amount': line.amount,
                'date': self.get_session_date(line.create_date)
            })
        return values

    def get_cash_out(self):
        values = []
        account_bank_statement_lines = self.env['account.bank.statement.line'].search([
            ('pos_session_id', '=', self.id),
            ('pos_cash_type', '=', 'out')
        ])
        for line in account_bank_statement_lines:
            values.append({
                'amount': line.amount,
                'date': self.get_session_date(line.create_date)
            })
        return values

    @api.multi
    def get_inventory_details(self):
        product_product = self.env['product.product']
        stock_location = self.config_id.stock_location_id
        inventory_records = []
        final_list = []
        product_details = []
        if self and self.id:
            for order in self.order_ids:
                for line in order.lines:
                    product_details.append({
                        'id': line.product_id.id,
                        'qty': line.qty,
                    })
        custom_list = []
        for each_prod in product_details:
            if each_prod.get('id') not in [x.get('id') for x in custom_list]:
                custom_list.append(each_prod)
            else:
                for each in custom_list:
                    if each.get('id') == each_prod.get('id'):
                        each.update({'qty': each.get('qty') + each_prod.get('qty')})
        for each in custom_list:
            product_id = product_product.browse(each.get('id'))
            if product_id:
                inventory_records.append({
                    'product_id': [product_id.id, product_id.name],
                    'category_id': [product_id.id, product_id.categ_id.name],
                    'used_qty': each.get('qty'),
                    'quantity': product_id.with_context(
                        {'location': stock_location.id, 'compute_child': False}).qty_available,
                    'uom_name': product_id.uom_id.name or ''
                })
            if inventory_records:
                temp_list = []
                temp_obj = []
                for each in inventory_records:
                    if each.get('product_id')[0] not in temp_list:
                        temp_list.append(each.get('product_id')[0])
                        temp_obj.append(each)
                    else:
                        for rec in temp_obj:
                            if rec.get('product_id')[0] == each.get('product_id')[0]:
                                qty = rec.get('quantity') + each.get('quantity')
                                rec.update({'quantity': qty})
                final_list = sorted(temp_obj, key=lambda k: k['quantity'])
        return final_list or []

    @api.multi
    def get_proxy_ip(self):
        proxy_id = self.env['res.users'].browse([self._uid]).company_id.report_ip_address
        return {'ip': proxy_id or False}

    @api.multi
    def get_user(self):
        if self._uid == SUPERUSER_ID:
            return True

    @api.multi
    def get_gross_total(self):
        gross_total = 0.0
        if self and self.order_ids:
            for order in self.order_ids:
                for line in order.lines:
                    gross_total += line.qty * (line.price_unit - line.product_id.standard_price)
        return gross_total

    @api.multi
    def get_product_cate_total(self):
        balance_end_real = 0.0
        if self and self.order_ids:
            for order in self.order_ids:
                for line in order.lines:
                    balance_end_real += (line.qty * line.price_unit)
        return balance_end_real

    @api.multi
    def get_net_gross_total(self):
        net_gross_profit = 0.0
        if self:
            net_gross_profit = self.get_gross_total() - self.get_total_tax()
        return net_gross_profit

    @api.multi
    def get_product_name(self, category_id):
        if category_id:
            category_name = self.env['pos.category'].browse([category_id]).name
            return category_name

    @api.multi
    def get_payments(self):
        if self:
            statement_line_obj = self.env["account.bank.statement.line"]
            pos_order_obj = self.env["pos.order"]
            company_id = self.env['res.users'].browse([self._uid]).company_id.id
            pos_ids = pos_order_obj.search([('state', 'in', ['paid', 'invoiced', 'done']),
                                            ('company_id', '=', company_id), ('session_id', '=', self.id)])
            data = {}
            if pos_ids:
                pos_ids = [pos.id for pos in pos_ids]
                st_line_ids = statement_line_obj.search([('pos_statement_id', 'in', pos_ids)])
                if st_line_ids:
                    a_l = []
                    for r in st_line_ids:
                        a_l.append(r['id'])
                    self._cr.execute(
                        "select aj.name,sum(amount) from account_bank_statement_line as absl,account_bank_statement as abs,account_journal as aj " \
                        "where absl.statement_id = abs.id and abs.journal_id = aj.id  and absl.id IN %s " \
                        "group by aj.name ", (tuple(a_l),))

                    data = self._cr.dictfetchall()
                    return data
            else:
                return {}

    @api.multi
    def get_product_category(self):
        product_list = []
        if self and self.order_ids:
            for order in self.order_ids:
                for line in order.lines:
                    flag = False
                    product_dict = {}
                    for lst in product_list:
                        if line.product_id.pos_categ_id:
                            if lst.get('pos_categ_id') == line.product_id.pos_categ_id.id:
                                lst['price'] = lst['price'] + (line.qty * line.price_unit)
                                flag = True
                        else:
                            if lst.get('pos_categ_id') == '':
                                lst['price'] = lst['price'] + (line.qty * line.price_unit)
                                flag = True
                    if not flag:
                        product_dict.update({
                            'pos_categ_id': line.product_id.pos_categ_id and line.product_id.pos_categ_id.id or '',
                            'price': (line.qty * line.price_unit)
                        })
                        product_list.append(product_dict)
        return product_list

    @api.multi
    def get_journal_amount(self):
        journal_list = []
        if self and self.statement_ids:
            for statement in self.statement_ids:
                if statement.balance_end > 0:
                    journal_dict = {}
                    journal_dict.update({
                        'journal_id': statement.journal_id and statement.journal_id.name or '',
                        'ending_bal': statement.balance_end})
                    journal_list.append(journal_dict)
        return journal_list

    @api.multi
    def get_total_closing(self):
        if self:
            return self.cash_register_balance_end_real

    @api.multi
    def get_total_sales(self):
        total_price = 0.0
        if self:
            for order in self.order_ids:
                total_price += sum([(line.qty * line.price_unit) for line in order.lines])
        return total_price

    @api.multi
    def get_total_tax(self):
        if self:
            total_tax = 0.0
            pos_order_obj = self.env['pos.order']
            total_tax += sum([order.amount_tax for order in pos_order_obj.search([('session_id', '=', self.id)])])
        return total_tax

    @api.multi
    def get_vat_tax(self):
        taxes_info = []
        if self:
            tax_list = [tax.id for order in self.order_ids for line in
                        order.lines.filtered(lambda line: line.tax_ids_after_fiscal_position) for tax in
                        line.tax_ids_after_fiscal_position]
            tax_list = list(set(tax_list))
            for tax in self.env['account.tax'].browse(tax_list):
                total_tax = 0.00
                net_total = 0.00
                for line in self.env['pos.order.line'].search(
                        [('order_id', 'in', [order.id for order in self.order_ids])]).filtered(
                    lambda line: tax in line.tax_ids_after_fiscal_position):
                    total_tax += line.price_subtotal * tax.amount / 100
                    net_total += line.price_subtotal
                taxes_info.append({
                    'tax_name': tax.name,
                    'tax_total': total_tax,
                    'tax_per': tax.amount,
                    'net_total': net_total,
                    'gross_tax': total_tax + net_total
                })
        return taxes_info

    @api.multi
    def get_total_discount(self):
        total_discount = 0.0
        if self and self.order_ids:
            for order in self.order_ids:
                total_discount += sum([((line.qty * line.price_unit) * line.discount) / 100 for line in order.lines])
        return total_discount

    @api.multi
    def get_total_first(self):
        return sum(order.amount_total for order in self.order_ids)

    def get_session_date(self, date_time):
        if date_time:
            if version_info != 12:
                date_time = datetime.strptime(date_time, DEFAULT_SERVER_DATETIME_FORMAT)
            if self.env.user and self.env.user.tz:
                tz = timezone(self.env.user.tz)
            else:
                tz = pytz.utc
            c_time = datetime.now(tz)
            hour_tz = int(str(c_time)[-5:][:2])
            min_tz = int(str(c_time)[-5:][3:])
            sign = str(c_time)[-6][:1]
            if sign == '+':
                date_time = date_time + \
                            timedelta(hours=hour_tz, minutes=min_tz)
            else:
                date_time = date_time - \
                            timedelta(hours=hour_tz, minutes=min_tz)
            return date_time.strftime('%d/%m/%Y %I:%M:%S %p')

    def get_session_time(self, date_time):
        if date_time:
            if version_info != 12:
                date_time = datetime.strptime(date_time, DEFAULT_SERVER_DATETIME_FORMAT)
            if self.env.user and self.env.user.tz:
                tz = timezone(self.env.user.tz)
            else:
                tz = pytz.utc
            c_time = datetime.now(tz)
            hour_tz = int(str(c_time)[-5:][:2])
            min_tz = int(str(c_time)[-5:][3:])
            sign = str(c_time)[-6][:1]
            if sign == '+':
                date_time = date_time + \
                            timedelta(hours=hour_tz, minutes=min_tz)
            else:
                date_time = date_time - \
                            timedelta(hours=hour_tz, minutes=min_tz)
            return date_time.strftime('%I:%M:%S %p')

    def get_current_date(self):
        if self.env.user and self.env.user.tz:
            tz = self.env.user.tz
            tz = timezone(tz)
        else:
            tz = pytz.utc
        if tz:
            c_time = datetime.now(tz)
            return c_time.strftime('%d/%m/%Y')
        else:
            return date.today().strftime('%d/%m/%Y')

    def get_current_time(self):
        if self.env.user and self.env.user.tz:
            tz = self.env.user.tz
            tz = timezone(tz)
        else:
            tz = pytz.utc
        if tz:
            c_time = datetime.now(tz)
            return c_time.strftime('%I:%M %p')
        else:
            return datetime.now().strftime('%I:%M:%S %p')
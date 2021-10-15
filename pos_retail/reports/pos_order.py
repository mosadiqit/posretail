# -*- coding: utf-8 -*-
from odoo import fields, api, models
import odoo
from datetime import datetime
from odoo.tools import DEFAULT_SERVER_DATETIME_FORMAT

import logging

_logger = logging.getLogger(__name__)


class pos_order(models.Model):
    _inherit = 'pos.order'

    @api.model
    def payment_summary_report(self, vals):
        version_info = odoo.release.version_info[0]
        if (vals):
            if not vals.get('summary', None):
                vals['summary'] = 'sales_person'
            journals_detail = {}
            salesmen_detail = {}
            summary_data = {}
            order_detail = []
            domain = []
            if vals.get('session_id'):
                domain = [('session_id', '=', vals.get('session_id'))]
            else:
                domain = [
                    ('date_order', '>=', vals.get('from_date')),
                    ('date_order', '<=', vals.get('to_date'))
                ]
            if vals.get('pos_branch_id'):
                domain.append(('pos_branch_id', '=', vals.get('pos_branch_id')))
            order_detail = self.sudo().search(domain)
            if vals.get('summary', None) == 'journals':
                if (order_detail):
                    for each_order in order_detail:
                        order_date = each_order.date_order
                        date1 = order_date
                        if version_info == 12:
                            date1 = date1.strftime(DEFAULT_SERVER_DATETIME_FORMAT)
                        month_year = datetime.strptime(date1, DEFAULT_SERVER_DATETIME_FORMAT).strftime("%B-%Y")
                        if not month_year in journals_detail:
                            journals_detail[month_year] = {}
                            for payment_line in each_order.statement_ids:
                                if payment_line.statement_id.journal_id.name in journals_detail[month_year]:
                                    payment = journals_detail[month_year][payment_line.statement_id.journal_id.name]
                                    payment += payment_line.amount
                                else:
                                    payment = payment_line.amount
                                journals_detail[month_year][payment_line.statement_id.journal_id.name] = float(
                                    format(payment, '2f'));
                        else:
                            for payment_line in each_order.statement_ids:
                                if payment_line.statement_id.journal_id.name in journals_detail[month_year]:
                                    payment = journals_detail[month_year][payment_line.statement_id.journal_id.name]
                                    payment += payment_line.amount
                                else:
                                    payment = payment_line.amount
                                journals_detail[month_year][payment_line.statement_id.journal_id.name] = float(
                                    format(payment, '2f'));
                    for journal in journals_detail.values():
                        for i in journal:
                            if i in summary_data:
                                total = journal[i] + summary_data[i]
                            else:
                                total = journal[i]
                            summary_data[i] = float(format(total, '2f'));

            if vals.get('summary', None) == 'sales_person':
                if (order_detail):
                    for each_order in order_detail:
                        order_date = each_order.date_order
                        date1 = order_date
                        if version_info == 12:
                            date1 = date1.strftime(DEFAULT_SERVER_DATETIME_FORMAT)
                        month_year = datetime.strptime(date1, DEFAULT_SERVER_DATETIME_FORMAT).strftime("%B-%Y")
                        if each_order.user_id.name not in salesmen_detail:
                            salesmen_detail[each_order.user_id.name] = {}
                            if not month_year in salesmen_detail[each_order.user_id.name]:
                                salesmen_detail[each_order.user_id.name][month_year] = {}
                                for payment_line in each_order.statement_ids:
                                    if payment_line.statement_id.journal_id.name in \
                                            salesmen_detail[each_order.user_id.name][month_year]:
                                        payment = salesmen_detail[each_order.user_id.name][month_year][
                                            payment_line.statement_id.journal_id.name]
                                        payment += payment_line.amount
                                    else:
                                        payment = payment_line.amount
                                    salesmen_detail[each_order.user_id.name][month_year][
                                        payment_line.statement_id.journal_id.name] = float(
                                        format(payment, '2f'));
                        else:
                            if not month_year in salesmen_detail[each_order.user_id.name]:
                                salesmen_detail[each_order.user_id.name][month_year] = {}
                                for payment_line in each_order.statement_ids:
                                    if payment_line.statement_id.journal_id.name in \
                                            salesmen_detail[each_order.user_id.name][month_year]:
                                        payment = salesmen_detail[each_order.user_id.name][month_year][
                                            payment_line.statement_id.journal_id.name]
                                        payment += payment_line.amount
                                    else:
                                        payment = payment_line.amount
                                    salesmen_detail[each_order.user_id.name][month_year][
                                        payment_line.statement_id.journal_id.name] = float(
                                        format(payment, '2f'));
                            else:
                                for payment_line in each_order.statement_ids:
                                    if payment_line.statement_id.journal_id.name in \
                                            salesmen_detail[each_order.user_id.name][month_year]:
                                        payment = salesmen_detail[each_order.user_id.name][month_year][
                                            payment_line.statement_id.journal_id.name]
                                        payment += payment_line.amount
                                    else:
                                        payment = payment_line.amount
                                    salesmen_detail[each_order.user_id.name][month_year][
                                        payment_line.statement_id.journal_id.name] = float(
                                        format(payment, '2f'));
        return {
            'journal_details': journals_detail,
            'salesmen_details': salesmen_detail,
            'summary_data': summary_data
        }

    @api.model
    def product_summary_report(self, vals):
        result = {
            'product_summary': {},
            'category_summary': {},
            'payment_summary': {},
            'location_summary': {},
        }
        if not vals:
            return result
        else:
            product_summary_dict = {}
            category_summary_dict = {}
            payment_summary_dict = {}
            location_summary_dict = {}
            product_qty = 0
            location_qty = 0
            category_qty = 0
            payment = 0
            domain = []
            if vals.get('session_id'):
                domain = [
                    ('session_id', '=', vals.get('session_id'))
                ]
            else:
                domain = [
                    ('date_order', '>=', vals.get('from_date')),
                    ('date_order', '<=', vals.get('to_date'))
                ]
            if vals.get('pos_branch_id'):
                domain.append(('pos_branch_id', '=', vals.get('pos_branch_id')))
            order_detail = self.sudo().search(domain)
            if ('product_summary' in vals.get('summary') or len(vals.get('summary')) == 0):
                if (order_detail):
                    for each_order in order_detail:
                        for each_order_line in each_order.lines:
                            if each_order_line.product_id.name in product_summary_dict:
                                product_qty = product_summary_dict[each_order_line.product_id.name]
                                product_qty += each_order_line.qty
                            else:
                                product_qty = each_order_line.qty
                            product_summary_dict[each_order_line.product_id.name] = product_qty;

            if ('category_summary' in vals.get('summary') or len(vals.get('summary')) == 0):
                if (order_detail):
                    for each_order in order_detail:
                        for each_order_line in each_order.lines:
                            if each_order_line.product_id.pos_categ_id.name in category_summary_dict:
                                category_qty = category_summary_dict[each_order_line.product_id.pos_categ_id.name]
                                category_qty += each_order_line.qty
                            else:
                                category_qty = each_order_line.qty
                            category_summary_dict[each_order_line.product_id.pos_categ_id.name] = category_qty;
                    if (False in category_summary_dict):
                        category_summary_dict['Others'] = category_summary_dict.pop(False);

            if ('payment_summary' in vals.get('summary') or len(vals.get('summary')) == 0):
                if (order_detail):
                    for each_order in order_detail:
                        for payment_line in each_order.statement_ids:
                            if payment_line.statement_id.journal_id.name in payment_summary_dict:
                                payment = payment_summary_dict[payment_line.statement_id.journal_id.name]
                                payment += payment_line.amount
                            else:
                                payment = payment_line.amount
                            payment_summary_dict[payment_line.statement_id.journal_id.name] = float(
                                format(payment, '2f'));

            if ('location_summary' in vals.get('summary') or len(vals.get('summary')) == 0):
                location_list = []
                for each_order in order_detail:
                    location_summary_dict[each_order.picking_id.location_id.name] = {}
                for each_order in order_detail:
                    for each_order_line in each_order.lines:
                        if each_order_line.product_id.name in location_summary_dict[
                            each_order.picking_id.location_id.name]:
                            location_qty = location_summary_dict[each_order.picking_id.location_id.name][
                                each_order_line.product_id.name]
                            location_qty += each_order_line.qty
                        else:
                            location_qty = each_order_line.qty
                        location_summary_dict[each_order.picking_id.location_id.name][
                            each_order_line.product_id.name] = location_qty
                location_list.append(location_summary_dict)

            return {
                'product_summary': product_summary_dict,
                'category_summary': category_summary_dict,
                'payment_summary': payment_summary_dict,
                'location_summary': location_summary_dict,
            }

    @api.model
    def order_summary_report(self, vals):
        order_list = {}
        category_list = {}
        payment_list = {}
        if vals:
            orders = []
            domain = []
            if vals.get('session_id'):
                domain = [('session_id', '=', vals.get('session_id'))]
            else:
                domain = [('date_order', '>=', vals.get('from_date')), ('date_order', '<=', vals.get('to_date'))]
            if vals.get('pos_branch_id'):
                domain.append(('pos_branch_id', '=', vals.get('pos_branch_id')))
            orders = self.sudo().search(domain)
            if ('order_summary_report' in vals['summary'] or len(vals['summary']) == 0):
                for each_order in orders:
                    order_list[each_order.state] = []
                for each_order in orders:
                    if each_order.state in order_list:
                        order_list[each_order.state].append({
                            'order_ref': each_order.name,
                            'order_date': each_order.date_order,
                            'total': float(format(each_order.amount_total, '.2f'))
                        })
                    else:
                        order_list.update({
                            each_order.state.append({
                                'order_ref': each_order.name,
                                'order_date': each_order.date_order,
                                'total': float(format(each_order.amount_total, '.2f'))
                            })
                        })
            if ('category_summary_report' in vals['summary'] or len(vals['summary']) == 0):
                count = 0.00
                amount = 0.00
                for each_order in orders:
                    category_list[each_order.state] = {}
                for each_order in orders:
                    for order_line in each_order.lines:
                        if each_order.state == 'paid':
                            if order_line.product_id.pos_categ_id.name in category_list[each_order.state]:
                                count = category_list[each_order.state][order_line.product_id.pos_categ_id.name][0]
                                amount = category_list[each_order.state][order_line.product_id.pos_categ_id.name][1]
                                count += order_line.qty
                                amount += order_line.price_subtotal_incl
                            else:
                                count = order_line.qty
                                amount = order_line.price_subtotal_incl
                        if each_order.state == 'done':
                            if order_line.product_id.pos_categ_id.name in category_list[each_order.state]:
                                count = category_list[each_order.state][order_line.product_id.pos_categ_id.name][0]
                                amount = category_list[each_order.state][order_line.product_id.pos_categ_id.name][1]
                                count += order_line.qty
                                amount += order_line.price_subtotal_incl
                            else:
                                count = order_line.qty
                                amount = order_line.price_subtotal_incl
                        if each_order.state == 'invoiced':
                            if order_line.product_id.pos_categ_id.name in category_list[each_order.state]:
                                count = category_list[each_order.state][order_line.product_id.pos_categ_id.name][0]
                                amount = category_list[each_order.state][order_line.product_id.pos_categ_id.name][1]
                                count += order_line.qty
                                amount += order_line.price_subtotal_incl
                            else:
                                count = order_line.qty
                                amount = order_line.price_subtotal_incl
                        category_list[each_order.state].update(
                            {order_line.product_id.pos_categ_id.name: [count, amount]})
                    if (False in category_list[each_order.state]):
                        category_list[each_order.state]['others'] = category_list[each_order.state].pop(False)

            if ('payment_summary_report' in vals['summary'] or len(vals['summary']) == 0):
                count = 0
                for each_order in orders:
                    payment_list[each_order.state] = {}
                for each_order in orders:
                    for payment_line in each_order.statement_ids:
                        if each_order.state == 'paid':
                            if payment_line.journal_id.name in payment_list[each_order.state]:
                                count = payment_list[each_order.state][payment_line.journal_id.name]
                                count += payment_line.amount
                            else:
                                count = payment_line.amount
                        if each_order.state == 'done':
                            if payment_line.journal_id.name in payment_list[each_order.state]:
                                count = payment_list[each_order.state][payment_line.journal_id.name]
                                count += payment_line.amount
                            else:
                                count = payment_line.amount
                        if each_order.state == 'invoiced':
                            if payment_line.journal_id.name in payment_list[each_order.state]:
                                count = payment_list[each_order.state][payment_line.journal_id.name]
                                count += payment_line.amount
                            else:
                                count = payment_line.amount
                        payment_list[each_order.state].update(
                            {payment_line.journal_id.name: float(format(count, '.2f'))})
            return {
                'order_report': order_list,
                'category_report': category_list,
                'payment_report': payment_list,
                'state': vals['state']
            }

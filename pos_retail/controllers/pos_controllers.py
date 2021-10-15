# -*- coding: utf-8 -*
from odoo.http import request
from odoo.addons.bus.controllers.main import BusController
from odoo.addons.point_of_sale.controllers.main import PosController
import json
import werkzeug.utils
from odoo import http, _
from odoo.addons.web.controllers.main import ensure_db, Home, Session, WebClient
from datetime import datetime

datetime.strptime('2012-01-01', '%Y-%m-%d')

import logging

_logger = logging.getLogger(__name__)


class pos_controller(PosController):

    @http.route('/pos/web', type='http', auth='user')
    def pos_web(self, debug=False, **k):
        _logger.info('--> begin start pos session of user: %s' % request.env.user.login)
        session_info = request.env['ir.http'].session_info()
        server_version_info = session_info['server_version_info'][0]
        pos_sessions = None
        if server_version_info == 10:
            pos_sessions = request.env['pos.session'].search([
                ('state', '=', 'opened'),
                ('user_id', '=', request.session.uid),
                ('name', 'not like', '(RESCUE FOR')])
        if server_version_info in [11, 12]:
            pos_sessions = request.env['pos.session'].search([
                ('state', '=', 'opened'),
                ('user_id', '=', request.session.uid),
                ('rescue', '=', False)])
        if not pos_sessions:  # auto direct login odoo to pos
            if request.env.user.pos_config_id:
                request.env.user.pos_config_id.current_session_id = request.env['pos.session'].sudo(
                    request.env.user.id).create({
                    'user_id': request.env.user.id,
                    'config_id': request.env.user.pos_config_id.id,
                })
                pos_sessions = request.env.user.pos_config_id.current_session_id
                pos_sessions.action_pos_session_open()
        if not pos_sessions:
            return werkzeug.utils.redirect('/web#action=point_of_sale.action_client_pos_menu')
        pos_session = pos_sessions[0]
        pos_session.login()
        session_info['currency_id'] = request.env.user.company_id.currency_id.id
        session_info['model_ids'] = {
            'product.product': {},
            'res.partner': {},
        }
        model_list = {
            'product.product': 'product_product',
            'res.partner': 'res_partner',
        }
        for object, table in model_list.items():
            request.env.cr.execute("select min(id) from %s" % table)
            min_ids = request.env.cr.fetchall()
            session_info['model_ids'][object]['min_id'] = min_ids[0][0] if min_ids and min_ids[0] else 1
            request.env.cr.execute("select max(id) from %s" % table)
            max_ids = request.env.cr.fetchall()
            session_info['model_ids'][object]['max_id'] = max_ids[0][0] if max_ids and max_ids[0] else 1
        # TODO: we add variable pos_session_id for pos frontend load correctly this pos session
        # TODO: default odoo always load with domain ['user_id','=', session.uid]
        # TODO: BUT when are active multi user, have many users open each pos config
        # TODO: so we force pos load pos session correctly with pos session id
        session_info['pos_session_id'] = pos_session.id
        context = {
            'session_info': json.dumps(session_info)
        }
        return request.render('point_of_sale.index', qcontext=context)


class web_login(Home):  # auto go directly POS when login

    def iot_login(self, db, login, password):
        try:
            request.session.authenticate(db, login, password)
            request.params['login_success'] = True
            return http.local_redirect('/pos/web/')
        except:
            return False

    @http.route()
    def web_login(self, *args, **kw):
        ensure_db()
        response = super(web_login, self).web_login(*args, **kw)
        if request.httprequest.method == 'GET' and kw.get('database', None) and kw.get('login', None) and kw.get(
                'password', None) and kw.get('iot_pos', None):
            return self.iot_login(kw.get('database', None), kw.get('login', None), kw.get('password', None))
        if request.session.uid:
            user = request.env['res.users'].browse(request.session.uid)
            pos_config = user.pos_config_id
            if pos_config:
                return http.local_redirect('/pos/web/')
        return response


class pos_bus(BusController):

    def _poll(self, dbname, channels, last, options):
        channels = list(channels)
        if request.env.user:
            channels.append((request.db, 'pos.test.polling', request.env.user.id))
            channels.append((request.db, 'pos.sync.pricelists', request.env.user.id))
            channels.append((request.db, 'pos.sync.promotions', request.env.user.id))
            channels.append((request.db, 'pos.remote_sessions', request.env.user.id))
            channels.append((request.db, 'pos.sync.backend', request.env.user.id))
            channels.append((request.db, 'pos.sync.stock', request.env.user.id))
        return super(pos_bus, self)._poll(dbname, channels, last, options)

    @http.route('/pos/update_order/status', type="json", auth="public")
    def bus_update_sale_order(self, status, order_name):
        sales = request.env["sale.order"].sudo().search([('name', '=', order_name)])
        sales.write({'sync_status': status})
        return 1

    @http.route('/pos/test/polling', type="json", auth="public")
    def test_polling(self, pos_id, messages):
        _logger.info('test_polling POS ID: %s' % pos_id)
        request.env['bus.bus'].sendmany(
            [[(request.env.cr.dbname, 'pos.test.polling', 1), messages]])
        return 1
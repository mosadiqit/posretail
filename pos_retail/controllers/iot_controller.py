# -*- coding: utf-8 -*
from odoo.http import request
import time
from threading import Thread, Lock
from odoo import http, _
import os

try:
    from xmlrpc import client as xmlrpclib
except ImportError:
    import xmlrpclib

try:
    from queue import Queue
except ImportError:
    from Queue import Queue  # pylint: disable=deprecated-module

# TODO: chef screens
from odoo.addons.web.controllers import main as web

import json
import logging

_logger = logging.getLogger(__name__)


class SyncDrive(Thread):

    def __init__(self):
        Thread.__init__(self)
        self.chef_login = {}
        self.lock = Lock()
        self.sync_datas = {}

    def register_point(self, database, config_ids):
        if not self.sync_datas.get(database, None):
            self.sync_datas[database] = {}
            for config_id in config_ids:
                if not self.sync_datas[database].get(config_id, None):
                    self.sync_datas[database][config_id] = Queue()
        return True

    def save_notification(self, database, send_from_config_id, config_ids, message):
        database_datas = self.sync_datas.get(database)
        if not database_datas:
            self.register_point(database, config_ids)
        databases = self.sync_datas.get(database)
        for config_id, values in databases.items():
            if config_id != send_from_config_id:
                databases[config_id].put((time.time(), config_id, message))
        return True

    def get_notifications(self, database, config_id):
        result_list = []
        if not self.sync_datas.get(database, None):
            self.sync_datas[database] = {}
            self.sync_datas[database][config_id] = Queue()
            return []
        else:
            if not self.sync_datas[database].get(config_id):
                self.sync_datas[database][config_id] = Queue()
            while not self.sync_datas[database][config_id].empty():
                result_list.append(self.sync_datas[database][config_id].get())
        return result_list


driver = SyncDrive()


class SyncController(web.Home):

    @http.route('/pos/register/sync', type="json", auth='none', cors='*')
    def register_sync(self, database, config_ids, sync_multi_session_offline):
        if sync_multi_session_offline:
            driver.register_point(database, config_ids)
        return json.dumps({'state': 'succeed', 'values': {}})

    @http.route('/pos/save/sync', type="json", auth='none', cors='*')
    def save_sync(self, database, send_from_config_id, config_ids, message, sync_multi_session_offline):
        if sync_multi_session_offline:
            driver.save_notification(database, send_from_config_id, config_ids, message)
        else:
            Log = request.env['pos.sync.session.log'].sudo()
            send_from_session = request.env['pos.session'].sudo().search([
                ('config_id', '=', send_from_config_id),
                ('state', '=', 'opened')
            ], limit=1)
            send_to_sessions = request.env['pos.session'].sudo().search([
                ('config_id', 'in', config_ids),
                ('state', '=', 'opened')
            ])
            if request.env.context.get('uid', None) and send_from_session:
                Log.create({
                    'send_from_session_id': send_from_session.id,
                    'user_id': request.env.context.get('uid', None),
                    'action': message.get('action', None),
                    'logs': json.dumps(message)
                })
                for send_to_session in send_to_sessions:
                    Log.create({
                        'send_from_session_id': send_from_session.id,
                        'send_to_session_id': send_to_session.id,
                        'user_id': request.env.context.get('uid', None),
                        'user_receive_id': send_to_session.user_id.id,
                        'action': message.get('action', None),
                        'logs': json.dumps(message)
                    })
        return json.dumps({'state': 'succeed', 'values': {}})

    @http.route('/pos/get/sync', type="json", auth='none', cors='*')
    def get_sync(self, database, config_id, session_id, sync_multi_session_offline):
        if sync_multi_session_offline:
            values = driver.get_notifications(database, config_id)
        else:
            values = []
            Log = request.env['pos.sync.session.log'].sudo()
            logs = Log.search([
                ('send_to_session_id', '=', session_id),
                ('state', '=', 'ready')
            ])
            log_ids = []
            for log in logs:
                values.append([0, 0, json.loads(log.logs)])
                log_ids.append(log.id)
            if len(log_ids) > 0:
                if len(log_ids) == 1:
                    log_ids.append(0)
                request.env.cr.execute("UPDATE pos_sync_session_log SET state='restored' WHERE id in %s",  (tuple(log_ids),))
                request.env.cr.commit()
        return json.dumps({'state': 'succeed', 'values': values})

    @http.route('/pos/passing/login', type='http', auth='none', cors='*')
    def pos_login(self):
        return "ping"

    @http.route('/pos/display-chef-screen', type="json", auth='none', cors='*')
    def display_chef_screen(self, link, database, login, password):
        try:
            driver.xmlrpc_url = url_8 = '%s/xmlrpc/2/' % link
            driver.xmlrpc_common = xmlrpclib.ServerProxy(url_8 + 'common')
            driver.xmlrpc_object = xmlrpclib.ServerProxy(url_8 + 'object')
            driver.uid = driver.xmlrpc_common.login(database, login, password)
            if driver.uid:
                driver.chef_login['link'] = link
                driver.chef_login['database'] = database
                driver.chef_login['login'] = login
                driver.chef_login['password'] = password
                return json.dumps({'state': 'succeed', 'values': driver.uid})
            else:
                return json.dumps({'state': 'fail', 'values': 'login fail'})
        except:
            return json.dumps({'state': 'fail', 'values': 'login fail'})

    @http.route('/pos/get-login-chef', type='json', auth='none')
    def get_login_chef_screen(self):
        return driver.chef_login

    @http.route('/pos/reboot', type='json', auth='none', cors='*')
    def reboot(self):
        os.system('sudo reboot now')
        return json.dumps({'state': 'succeed', 'values': 'OK'})

# -*- coding: utf-8 -*-
from odoo import http
import logging
import json
from odoo.addons.hw_escpos.escpos.printer import Network
from odoo.addons.web.controllers import main as web
import time

import platform    # For getting the operating system name
import subprocess  # For executing a shell command
import time


_logger = logging.getLogger(__name__)

try:
    from odoo.addons.hw_proxy.controllers import main as hw_proxy
    from odoo.addons.hw_escpos.controllers.main import EscposDriver
except ImportError:
    EscposDriver = object


class EscposNetworkDriver(EscposDriver):

    def print_network(self, receipt, proxy, name=None):
        time.sleep(1)
        printer_object = Network(proxy)
        printer_object.open()
        if printer_object:
            printer_object.receipt(receipt)
            printer_object.__del__()
            return True
        return False


network_driver = EscposNetworkDriver()

class NetworkEscposProxy(web.Home):

    @http.route('/hw_proxy/print_network', type='json', auth='none', cors='*')
    def epson_printing(self, receipt, proxy):
        _logger.info('----- Print Lan Network ------')
        _logger.info('proxy ip: %s' % proxy)
        result = network_driver.print_network(receipt, proxy)
        return json.dumps({'state': 'succeed', 'values': result})

    def ping(self, host):
        param = '-n' if platform.system().lower()=='windows' else '-c'
        command = ['ping', param, '1', host]
        return subprocess.call(command) == 0

    @http.route('/hw_proxy/get_printers_status', type='json', auth='none', cors='*')
    def ping_printer(self, printer_ips=[]):
        _logger.info('ESCPOS: ping proxy %s' % printer_ips)
        values = {}
        for printer_ip in printer_ips:
            result = self.ping(printer_ip)
            _logger.info(result)
            if printer_ip:
                values[printer_ip] = 'Online'
            else:
                values[printer_ip] = 'Offline'
        return json.dumps({'state': 'succeed', 'values': values})

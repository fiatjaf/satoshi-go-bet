/** @format */

import React, {useEffect} from 'react'
import {QRCode} from 'react-qr-svg'

export default function Invoice({invoice, onPaid, hide}) {
  function stopShowing(e) {
    e.preventDefault()
    hide()
  }

  function handlePaid(e) {
    e.preventDefault()
    onPaid()
  }

  useEffect(
    () => {
      try {
        window.webln.sendPayment(invoice).then(onPaid)
      } catch (e) {}
    },
    [invoice]
  )

  return (
    <div id="invoice">
      <p>Pay the following invoice to make this call:</p>
      <a href={'lightning:' + invoice}>
        <QRCode level="Q" style={{width: 512}} value={invoice} />
      </a>
      <pre>{invoice}</pre>
      <div className="controls">
        <button onClick={stopShowing}>Cancel</button>
        <button onClick={handlePaid}>Paid!</button>
      </div>
    </div>
  )
}

/** @format */

import React from 'react'
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

  return (
    <div id="invoice">
      <p>Pay the following invoice to make this call:</p>
      <QRCode level="Q" style={{width: 512}} value={invoice} />
      <div className="controls">
        <button onClick={stopShowing}>Cancel</button>
        <button onClick={handlePaid}>Paid!</button>
      </div>
    </div>
  )
}

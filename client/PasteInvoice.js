/** @format */

import React from 'react'

export default function PasteInvoice({onPasted, hide}) {
  function handlePasted(e) {
    e.preventDefault()
    onPasted(e.target.invoice.value)
  }

  function stopShowing(e) {
    e.preventDefault()
    hide()
  }

  return (
    <div id="paste-invoice">
      <p>Paste your invoice here:</p>
      <form onSubmit={handlePasted}>
        <textarea name="invoice" />
        <div className="controls">
          <a onClick={stopShowing}>Cancel</a>
          <button>Pasted!</button>
        </div>
      </form>
    </div>
  )
}

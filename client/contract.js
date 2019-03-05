/** @format */

import get from 'just-safe-get'

import * as toast from './toast'

export async function loadContract() {
  let r = await fetch(`${window.etleneum}/~/contract/${window.contract}/state`)

  if (!r.ok) {
    toast.error((await r.json()).error)
    return
  }

  return (await r.json()).value
}

export async function makeCall(
  method,
  satoshis,
  payload,
  {showInvoice, invoiceAt, showPasteInvoice}
) {
  if (invoiceAt) {
    let invoice = await new Promise((resolve, reject) => {
      showPasteInvoice({
        onPasted: pasted => {
          showPasteInvoice(null)
          resolve(pasted)
        },
        hide: () => showPasteInvoice(null)
      })
    })
    payload[invoiceAt] = invoice
  }

  let r = await fetch(`${window.etleneum}/~/contract/${window.contract}/call`, {
    method: 'POST',
    body: JSON.stringify({
      satoshis,
      method,
      payload
    })
  })

  if (!r.ok) {
    toast.error((await r.json()).error)
    return
  }

  let {id: callid, invoice} = (await r.json()).value

  return new Promise((resolve, reject) => {
    showInvoice({
      invoice,
      onPaid: async () => {
        let r = await fetch(`${window.etleneum}/~/call/${callid}`, {
          method: 'POST'
        })
        if (!r.ok) {
          toast.error((await r.json()).error)
          reject()
          return
        }

        showInvoice(null)
        resolve((await r.json()).value)
      },
      hide: () => showInvoice(null)
    })
  })
}

export function getUserTokens(state, userId) {
  var userTokens = []

  let tokens = get(state, 'tokens') || {}
  for (let gameid in tokens) {
    for (let winner in tokens[gameid]) {
      let amount = tokens[gameid][winner][userId]
      if (amount) {
        userTokens.push({gameid, winner, amount})
      }
    }
  }

  return userTokens
}

export function getUserOffers(state, userId) {
  var userOffers = []

  let offers = get(state, 'offers') || {}
  for (let gameid in offers) {
    for (let winner in offers[gameid]) {
      for (let i = 0; i < offers[gameid][winner].length; i++) {
        let offer = offers[gameid][winner][i]
        if (offer.seller === userId) {
          userOffers.push({...offer, winner, gameid})
        }
      }
    }
  }

  return userOffers
}

export function getAllTokens(state) {
  var allTokens = {}

  let tokens = get(state, 'tokens') || {}
  for (let gameid in tokens) {
    allTokens[gameid] = tokensForGame(state, gameid)
  }

  return allTokens
}

export function tokensForGame(state, gameid) {
  let byWinner = get(state, ['tokens', gameid]) || {black: {}, white: {}}
  var byUser = {}
  ;['black', 'white'].forEach(winner => {
    for (let userid in byWinner[winner]) {
      byUser[userid] = byUser[userid] || {black: 0, white: 0}
      byUser[userid][winner] = byWinner[winner][userid]
    }
  })
  return byUser
}

export function getAllOffers(state) {
  var allOffers = {}

  let offers = get(state, 'offers') || {}
  for (let gameid in offers) {
    allOffers[gameid] = offersForGame(state, gameid)
  }

  return allOffers
}

export function offersForGame(state, gameid) {
  return get(state, ['offers', gameid]) || {black: [], white: []}
}

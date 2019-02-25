/** @format */

import shajs from 'sha.js'
import uuid from 'uuid/v4'

var key = localStorage.getItem('user.key')
if (!key) {
  key = uuid()
  localStorage.setItem('user.key', key)
}
const user = {
  key,
  id: shajs('sha256')
    .update(key)
    .digest('hex')
}

export default user

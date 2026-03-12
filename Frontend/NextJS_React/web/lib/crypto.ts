// Re-exporta bcrypt para que el Backend pueda importarlo via @web/lib/crypto
// Sin este puente, Backend/Autenticacion/auth.ts no puede resolver bcrypt
// ya que bcrypt se instala en Frontend/node_modules (no en Backend/).
import bcrypt from 'bcrypt'
export default bcrypt

const destination = new URL('../', location.href)
destination.search = location.search
destination.hash = location.hash
location.replace(destination)

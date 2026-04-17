import { ApolloClient, InMemoryCache, createHttpLink, split } from '@apollo/client'
import { setContext } from '@apollo/client/link/context'
import { GraphQLWsLink } from '@apollo/client/link/subscriptions'
import { createClient } from 'graphql-ws'
import { getMainDefinition } from '@apollo/client/utilities'
import { getSession } from 'next-auth/react'

const httpLink = createHttpLink({
  uri: `${process.env.NEXT_PUBLIC_HASURA_URL}/v1/graphql`,
})

const authLink = setContext(async (_, { headers }) => {
  let token = ''
  try {
    if (typeof window !== 'undefined') {
      const session = await getSession() as any
      token = session?.user?.accessToken || ''
    }
  } catch {}
  return {
    headers: {
      ...headers,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  }
})

let wsLink: GraphQLWsLink | null = null

function getWsLink() {
  if (typeof window === 'undefined') return null
  if (!wsLink) {
    wsLink = new GraphQLWsLink(
      createClient({
        url: `${process.env.NEXT_PUBLIC_HASURA_WS_URL}/v1/graphql`,
        connectionParams: async () => {
          const session = await getSession() as any
          const token = session?.user?.accessToken || ''
          return token ? { headers: { authorization: `Bearer ${token}` } } : {}
        },
      })
    )
  }
  return wsLink
}

function getLink() {
  const ws = getWsLink()
  if (!ws) return authLink.concat(httpLink)
  return split(
    ({ query }) => {
      const def = getMainDefinition(query)
      return def.kind === 'OperationDefinition' && def.operation === 'subscription'
    },
    ws,
    authLink.concat(httpLink)
  )
}

export function createApolloClient() {
  return new ApolloClient({
    link: getLink(),
    cache: new InMemoryCache(),
    ssrMode: typeof window === 'undefined',
  })
}

let globalClient: ApolloClient<any> | null = null

export function getApolloClient() {
  if (typeof window === 'undefined') return createApolloClient()
  if (!globalClient) globalClient = createApolloClient()
  return globalClient
}

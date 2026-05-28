import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { getBotIdentity, getBotGuildMember, getChannelInfo } from "@/lib/discord/bot"

const GUILD_ID = "1505156684753010698"
const CHANNEL_IDS = {
  schedule: "1505158601222783026",
  charts: "1505158658902851734",
  drama: "1505158724107501619",
  korean: "1505158766759514162",
}

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: isAdminUser } = await supabase.rpc("is_admin", { uid: user.id })
  if (!isAdminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const [identity, guildMember, ...channels] = await Promise.allSettled([
    getBotIdentity(),
    getBotGuildMember(GUILD_ID),
    ...Object.entries(CHANNEL_IDS).map(([, id]) => getChannelInfo(id)),
  ])

  const channelResults = Object.fromEntries(
    Object.keys(CHANNEL_IDS).map((name, i) => [
      name,
      channels[i].status === "fulfilled" ? channels[i].value : { error: (channels[i] as PromiseRejectedResult).reason?.message },
    ])
  )

  return NextResponse.json({
    bot: identity.status === "fulfilled" ? identity.value : { error: (identity as PromiseRejectedResult).reason?.message },
    guildMember: guildMember.status === "fulfilled" ? guildMember.value : { error: (guildMember as PromiseRejectedResult).reason?.message },
    channels: channelResults,
  })
}

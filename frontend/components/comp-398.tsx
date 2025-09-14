import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"

export default function Component() {
  return (
    <div className="relative">
      <Avatar>
        <AvatarImage src="./avatar-80-07.jpg" alt="Kelly King" />
        <AvatarFallback>KK</AvatarFallback>
      </Avatar>
      <Badge className="border-background absolute -top-1.5 left-full min-w-5 -translate-x-3.5 px-1">
        6
      </Badge>
    </div>
  )
}

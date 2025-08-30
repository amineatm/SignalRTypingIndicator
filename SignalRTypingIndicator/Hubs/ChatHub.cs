using System.Collections.Concurrent;
using Microsoft.AspNetCore.SignalR;

namespace Chat.Api.Hubs;

public class ChatHub : Hub
{
    private const string ChatRoomGroup = "chat-room";
    private static readonly ConcurrentDictionary<string, string> UserNames = new();

    public async Task JoinChatRoom(string userName)
    {
        if (string.IsNullOrWhiteSpace(userName))
        {
            await Clients.Caller.SendAsync("Receive Error", "Username is required!");
            return;
        }

        var connectionId = Context.ConnectionId;
        UserNames[connectionId] = userName;

        await Groups.AddToGroupAsync(connectionId, ChatRoomGroup);
        await Clients.Group(ChatRoomGroup).SendAsync("User Joined", userName);
        await BroadcastUserListAsync();
    }

    public async Task SendMessage(string message)
    {
        if (string.IsNullOrWhiteSpace(message))
        {
            await Clients.Caller.SendAsync("Receive Error", "Message is required!");
            return;
        }

        var connectionId = Context.ConnectionId;
        if (!UserNames.TryGetValue(connectionId, out var username))
        {
            await Clients.Caller.SendAsync("Receive Error", "User info not found!");
            return;
        }

        var messageData = new { UserName = username, Message = message, TimeStamp = DateTime.UtcNow };
        await Clients.Group(ChatRoomGroup).SendAsync("Receive Message", messageData);
    }

    public async Task LeaveChatRoom()
    {
        var connectionId = Context.ConnectionId;
        if (!UserNames.TryGetValue(connectionId, out var username))
        {
            await Clients.Caller.SendAsync("Receive Error", "User info not found!");
            return;
        }

        await Groups.RemoveFromGroupAsync(connectionId, ChatRoomGroup);
        UserNames.TryRemove(connectionId, out _);

        await Clients.Group(ChatRoomGroup).SendAsync("User left", username);
        await BroadcastUserListAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var connectionId = Context.ConnectionId;
        if (UserNames.TryGetValue(connectionId, out var username))
        {
            await Clients.Group(ChatRoomGroup).SendAsync("User left", username);
            UserNames.TryRemove(connectionId, out _);
            await BroadcastUserListAsync();
        }
        await base.OnDisconnectedAsync(exception);
    }

    public async Task SetTyping(bool isTyping)
    {
        var id = Context.ConnectionId;
        if (!UserNames.TryGetValue(id, out var username)) return;

        await Clients.OthersInGroup(ChatRoomGroup)
            .SendAsync("UserTyping", new { UserName = username, IsTyping = isTyping, TimeStamp = DateTime.UtcNow });
    }

    public Task<List<string>> GetUsers()
    {
        var users = UserNames.Values.Distinct().OrderBy(n => n).ToList();
        return Task.FromResult(users);
    }

    private Task BroadcastUserListAsync()
    {
        var users = UserNames.Values.Distinct().OrderBy(n => n).ToList();
        return Clients.Group(ChatRoomGroup).SendAsync("UserList", users);
    }
}

from __future__ import annotations

from typing import Any, Dict

from django.shortcuts import get_object_or_404

from tenant.models.TicketModel import CommentLike, CommentReply, CommentReplyLike, TicketComment


def flag_comment(*, pk, comment_id, user) -> Dict[str, Any]:
    """Flag or unflag a comment"""
    comment = get_object_or_404(TicketComment, id=comment_id, ticket_id=pk)
    comment.flagged = not comment.flagged
    comment.save()

    action = "flagged" if comment.flagged else "unflagged"

    # Send notification email for flagged comments
    if comment.flagged:
        from shared.tasks import send_comment_interaction_notification
        send_comment_interaction_notification.delay(
            ticket_id=pk,
            comment_id=comment_id,
            interaction_type='flagged',
            actor_id=user.id
        )

    return {
        "message": f"Comment {action} successfully",
        "flagged": comment.flagged
    }


def like_comment(*, pk, comment_id, user) -> Dict[str, Any]:
    """Like or unlike a comment"""
    comment = get_object_or_404(TicketComment, id=comment_id, ticket_id=pk)

    # Check if user already liked this comment
    existing_like = CommentLike.objects.filter(comment=comment, user=user).first()

    if existing_like:
        # Unlike: remove the like
        existing_like.delete()
        comment.likes_count = max(0, comment.likes_count - 1)
        comment.save()
        return {
            "message": "Comment unliked successfully",
            "liked": False,
            "likes_count": comment.likes_count
        }
    else:
        # Like: create new like
        CommentLike.objects.create(comment=comment, user=user)
        comment.likes_count += 1
        comment.save()

        # Send notification email to comment author (if not the liker)
        if comment.author and comment.author.id != user.id:
            from shared.tasks import send_comment_interaction_notification
            send_comment_interaction_notification.delay(
                ticket_id=pk,
                comment_id=comment_id,
                interaction_type='liked',
                actor_id=user.id
            )

        return {
            "message": "Comment liked successfully",
            "liked": True,
            "likes_count": comment.likes_count
        }


def like_comment_reply(*, comment_id, reply_id, user) -> Dict[str, Any]:
    """Like or unlike a comment reply"""
    reply = get_object_or_404(CommentReply, id=reply_id, parent_comment_id=comment_id)

    # Check if user already liked this reply
    existing_like = CommentReplyLike.objects.filter(reply=reply, user=user).first()

    if existing_like:
        # Unlike: remove the like
        existing_like.delete()
        reply.likes_count = max(0, reply.likes_count - 1)
        reply.save()
        return {
            "message": "Reply unliked successfully",
            "liked": False,
            "likes_count": reply.likes_count
        }
    else:
        # Like: create new like
        CommentReplyLike.objects.create(reply=reply, user=user)
        reply.likes_count += 1
        reply.save()
        return {
            "message": "Reply liked successfully",
            "liked": True,
            "likes_count": reply.likes_count
        }
